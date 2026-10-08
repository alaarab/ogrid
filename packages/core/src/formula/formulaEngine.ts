/**
 * FormulaEngine  -  orchestrates parser, evaluator, dependency graph, and formula storage.
 */

import type {
  IFormulaEngineConfig,
  IRecalcResult,
  IFormulaFunction,
  IFormulaContext,
  IGridDataAccessor,
  CellKey,
  ICellAddress,
  ICellRange,
  ASTNode,
  IAuditEntry,
  IAuditTrail,
  ISpillRange,
  IDetachedEvaluationOptions,
} from './types';
import { SpillStore } from './spillStore';
import { FormulaError } from './types';
import { tokenize } from './tokenizer';
import { parse } from './parser';
import { FormulaEvaluator } from './evaluator';
import { DependencyGraph } from './dependencyGraph';
import type { IRangeDependency } from './dependencyGraph';
import { createBuiltInFunctions } from './functions';
import { MAX_RANGE_CELLS } from './limits';
export { MAX_RANGE_CELLS } from './limits';
import { toCellKey, fromCellKey } from './cellAddressUtils';

/** Shared empty cycle set, so recalcCells can default without allocating. */
const EMPTY_CYCLIC: ReadonlySet<CellKey> = Object.freeze(new Set<CellKey>());

/**
 * Functions whose references are computed at evaluation time, so the
 * dependency graph can't see them. Formulas using them recalc on every change.
 */
const DYNAMIC_REFERENCE_FUNCTIONS = new Set(['INDIRECT', 'OFFSET']);
const VOLATILE_FUNCTIONS: ReadonlySet<string> = new Set(['INDIRECT', 'OFFSET', 'RAND', 'RANDBETWEEN', 'RANDARRAY', 'NOW', 'TODAY']);

/** Upper bound on range cells expanded when listing audit precedents. */
const MAX_AUDIT_RANGE_CELLS = 10_000;

interface EngineContext extends IFormulaContext {
  getFreshCellValue(address: ICellAddress): unknown;
  getFreshRangeValues(range: ICellRange): unknown[][];
  getFreshArrayRangeValues(range: ICellRange): unknown[][];
}

const REF_ERROR_NODE: ASTNode = { kind: 'error', error: new FormulaError('#REF!', 'Reference out of range') };

function shiftAddress(a: ICellAddress, dCol: number, dRow: number): ICellAddress | null {
  const col = a.absCol ? a.col : a.col + dCol;
  const row = a.absRow ? a.row : a.row + dRow;
  if (col < 0 || row < 0) return null;
  return col === a.col && row === a.row ? a : { ...a, col, row };
}

/** Copy of `node` with relative references moved by (dCol, dRow); off-sheet references become #REF!. */
function shiftReferences(node: ASTNode, dCol: number, dRow: number): ASTNode {
  if (dCol === 0 && dRow === 0) return node;
  switch (node.kind) {
    case 'spillRef':
    case 'cellRef': {
      const address = shiftAddress(node.address, dCol, dRow);
      return address ? { ...node, address } : REF_ERROR_NODE;
    }
    case 'range': {
      const start = shiftAddress(node.start, dCol, dRow);
      const end = shiftAddress(node.end, dCol, dRow);
      return start && end ? { ...node, start, end } : REF_ERROR_NODE;
    }
    case 'functionCall':
      return { ...node, args: node.args.map((a) => shiftReferences(a, dCol, dRow)) };
    case 'binaryOp':
      return { ...node, left: shiftReferences(node.left, dCol, dRow), right: shiftReferences(node.right, dCol, dRow) };
    case 'unaryOp':
      return { ...node, operand: shiftReferences(node.operand, dCol, dRow) };
    default:
      return node;
  }
}

interface FormulaDependencies {
  cells: Set<CellKey>;
  ranges: IRangeDependency[];
  volatile: boolean;
  dynamicReferences: boolean;
}

/**
 * Extract all cell and range references from an AST node (for dependency
 * tracking). Ranges stay ranges: expanding `A1:A100000` into 100k keys made a
 * single formula freeze the page.
 */
function extractDependencies(node: ASTNode): FormulaDependencies {
  const cells = new Set<CellKey>();
  const ranges: IRangeDependency[] = [];
  let volatile = false;
  let dynamicReferences = false;

  const stack = [node];
  while (stack.length) {
    const n = stack.pop();
    if (!n) break;
    switch (n.kind) {
      case 'spillRef':
      case 'cellRef':
        cells.add(toCellKey(n.address.col, n.address.row, n.address.sheet));
        break;
      case 'range': {
        const minRow = Math.min(n.start.row, n.end.row);
        const maxRow = Math.max(n.start.row, n.end.row);
        const minCol = Math.min(n.start.col, n.end.col);
        const maxCol = Math.max(n.start.col, n.end.col);
        if (minRow === maxRow && minCol === maxCol) {
          cells.add(toCellKey(minCol, minRow, n.start.sheet));
        } else {
          ranges.push({ sheet: n.start.sheet, minRow, maxRow, minCol, maxCol });
        }
        break;
      }
      case 'functionCall':
        if (VOLATILE_FUNCTIONS.has(n.name)) volatile = true;
        if (DYNAMIC_REFERENCE_FUNCTIONS.has(n.name)) dynamicReferences = true;
        for (const arg of n.args) stack.push(arg);
        break;
      case 'binaryOp':
        stack.push(n.left, n.right);
        break;
      case 'unaryOp':
        stack.push(n.operand);
        break;
      // number, string, boolean, error  -  no dependencies
    }
  }

  return { cells, ranges, volatile, dynamicReferences };
}

export class FormulaEngine {
  private readonly spills = new SpillStore();
  private readonly pendingSpillUpdates: IRecalcResult['updatedCells'] = [];
  private readonly pendingSpillChanges = new Set<CellKey>();
  private readonly formulas = new Map<CellKey, string>();
  private readonly parsedFormulas = new Map<CellKey, ASTNode>();
  private readonly values = new Map<CellKey, unknown>();
  private readonly depGraph = new DependencyGraph();
  private readonly evaluator: FormulaEvaluator;
  private readonly maxRangeCells: number;
  private readonly namedRanges = new Map<string, string>();
  private readonly sheetAccessors = new Map<string, IGridDataAccessor>();
  /** Formula cells using INDIRECT/OFFSET; recalculated on every change. */
  private readonly dynamicReferenceCells = new Set<CellKey>();
  private readonly volatileCells = new Set<CellKey>();
  private lastAccessor?: IGridDataAccessor;
  /** High-water mark of formula cells past the data, so range reads include them (reset by clear()). */
  private maxFormulaRow = -1;
  private maxFormulaCol = -1;
  /** column -> rows holding formula cells (main sheet), for range overlays. */
  private readonly formulaRowsByCol = new Map<number, Set<number>>();

  constructor(config?: IFormulaEngineConfig) {
    const builtIns = createBuiltInFunctions();
    if (config?.customFunctions) {
      for (const [name, fn] of Object.entries(config.customFunctions)) {
        builtIns.set(name.toUpperCase(), fn);
      }
    }
    if (config?.namedRanges) {
      for (const [name, ref] of Object.entries(config.namedRanges)) {
        this.namedRanges.set(name.toUpperCase(), ref);
      }
    }
    this.maxRangeCells = config?.limits?.maxRangeCells ?? MAX_RANGE_CELLS;
    this.evaluator = new FormulaEvaluator(builtIns, config?.limits);
  }

  /**
   * Set or clear a formula for a cell.
   */
  setFormula(
    col: number,
    row: number,
    formula: string | null,
    accessor: IGridDataAccessor
  ): IRecalcResult {
    this.lastAccessor = accessor;
    const key = toCellKey(col, row);

    if (formula === null || formula === '') {
      // Clear formula
      const oldValue = this.values.get(key);
      // Capture the cascade before mutating the graph, then recalculate the
      // dependents  -  otherwise every cell referencing this one keeps the
      // value it had while the formula still existed.
      const spillUpdates: IRecalcResult['updatedCells'] = [];
      this.applyResult(key, undefined, accessor, spillUpdates);
      this.forgetFormula(key, col, row);
      this.depGraph.removeDependencies(key);
      const plan = this.depGraph.getRecalcPlanBatch([key, ...this.pendingSpillChanges], new Set([...this.volatileCells, ...this.spills.affected([key]), ...this.spills.affected(this.pendingSpillChanges, true)]));
      const updatedCells: IRecalcResult['updatedCells'] = oldValue !== undefined
        ? [{ cellKey: key, col, row, oldValue, newValue: undefined }]
        : [];
      updatedCells.push(...spillUpdates);
      this.recalcCells(plan.order, accessor, updatedCells, plan.cyclic);
      return this.recalcResult(updatedCells);
    }

    const ast = this.parseFormula(formula);
    const deps = extractDependencies(ast);
    const oldValue = this.values.get(key);

    // Circular reference: store the formula as #CIRC!, then recalc its
    // dependents so cells downstream don't keep values from before the cycle.
    if (this.depGraph.wouldCreateCycle(key, deps.cells, deps.ranges)) {
      const circError = new FormulaError('#CIRC!', 'Circular reference detected');
      this.rememberFormula(key, col, row, formula, ast, deps.volatile, deps.dynamicReferences);
      this.applyResult(key, circError, accessor);
      this.depGraph.setDependencies(key, deps.cells, deps.ranges);
      const updatedCells: IRecalcResult['updatedCells'] = [
        { cellKey: key, col, row, oldValue, newValue: circError },
      ];
      const plan = this.depGraph.getRecalcPlan(key);
      this.recalcCells(plan.order.filter((k) => k !== key), accessor, updatedCells, plan.cyclic);
      return this.recalcResult(updatedCells);
    }

    this.depGraph.setDependencies(key, deps.cells, deps.ranges);
    this.rememberFormula(key, col, row, formula, ast, deps.volatile, deps.dynamicReferences);

    // Evaluate the formula
    const context = this.createContext(accessor);
    const newValue = this.safeEvaluate(ast, context, key);
    const spillUpdates: IRecalcResult['updatedCells'] = [];
    this.applyResult(key, newValue, accessor, spillUpdates);

    const updatedCells: IRecalcResult['updatedCells'] = [
      { cellKey: key, col, row, oldValue, newValue: this.values.get(key) },
    ];

    updatedCells.push(...spillUpdates);

    // Cascade: recalculate all dependents (and volatile formulas)
    const plan = this.depGraph.getRecalcPlanBatch([key, ...this.pendingSpillChanges], new Set([...this.otherVolatiles(key), ...this.spills.affected([key]), ...this.spills.affected(this.pendingSpillChanges, true)]));
    this.recalcCells(plan.order, accessor, updatedCells, plan.cyclic);

    return this.recalcResult(updatedCells);
  }

  /**
   * Notify the engine that a non-formula cell's value changed.
   * Pass `sheet` when the cell belongs to a registered sheet rather than the main grid.
   */
  onCellChanged(
    col: number,
    row: number,
    accessor: IGridDataAccessor,
    sheet?: string
  ): IRecalcResult {
    this.lastAccessor = accessor;
    const key = toCellKey(col, row, sheet);
    const plan = this.depGraph.getRecalcPlanBatch([key, ...this.pendingSpillChanges], new Set([...this.volatileCells, ...this.spills.affected([key]), ...this.spills.affected(this.pendingSpillChanges, true)]));
    if (plan.order.length === 0) return { updatedCells: [] };

    const updatedCells: IRecalcResult['updatedCells'] = [];
    this.recalcCells(plan.order, accessor, updatedCells, plan.cyclic);
    return this.recalcResult(updatedCells);
  }

  /**
   * Batch notify: multiple cells changed. A cell with `sheet` belongs to that
   * registered sheet rather than the main grid.
   */
  onCellsChanged(
    cells: Array<{ col: number; row: number; sheet?: string }>,
    accessor: IGridDataAccessor
  ): IRecalcResult {
    this.lastAccessor = accessor;
    const keys = cells.map(c => toCellKey(c.col, c.row, c.sheet));
    const plan = this.depGraph.getRecalcPlanBatch(keys, new Set([...this.volatileCells, ...this.spills.affected(keys)]));
    if (plan.order.length === 0) return { updatedCells: [] };

    const updatedCells: IRecalcResult['updatedCells'] = [];
    this.recalcCells(plan.order, accessor, updatedCells, plan.cyclic);
    return this.recalcResult(updatedCells);
  }

  /**
   * Get the current computed value for a cell.
   */
  getValue(col: number, row: number): unknown | undefined {
    const key = toCellKey(col, row);
    return this.spills.owners.has(key) ? this.spills.getValue(key) : this.values.get(key);
  }

  /** Spill containing this cell, including its editable formula anchor. */
  getSpillRange(col: number, row: number): ISpillRange | undefined {
    return this.spills.getRange(col, row);
  }

  /**
   * Get the formula string for a cell.
   */
  getFormula(col: number, row: number): string | undefined {
    return this.formulas.get(toCellKey(col, row));
  }

  /**
   * Check if a cell has a formula.
   */
  hasFormula(col: number, row: number): boolean {
    return this.formulas.has(toCellKey(col, row));
  }

  /**
   * Register a custom function at runtime.
   */
  registerFunction(name: string, fn: IFormulaFunction): void {
    this.evaluator.registerFunction(name, fn);
  }

  /**
   * Full recalculation of all formulas.
   */
  recalcAll(accessor: IGridDataAccessor): IRecalcResult {
    this.lastAccessor = accessor;
    const updatedCells: IRecalcResult['updatedCells'] = [];
    const context = this.createContext(accessor);

    // Get all formula cells and recalc in dependency order
    if (this.formulas.size === 0) return this.recalcResult(updatedCells);
    const allFormulaKeys: CellKey[] = [];
    for (const key of this.formulas.keys()) allFormulaKeys.push(key);

    const plan = this.depGraph.getRecalcPlanBatch(allFormulaKeys);
    const recalcOrder = plan.order;
    // Also recalc any formula cells that have no dependents (root formulas)
    const ordered = new Set(recalcOrder);
    for (const key of allFormulaKeys) {
      if (!ordered.has(key)) {
        const { col, row } = fromCellKey(key);
        const ast = this.parsedFormulas.get(key);
        if (!ast) continue;
        const oldValue = this.values.get(key);
        const newValue = this.safeEvaluate(ast, context, key);
        this.applyResult(key, newValue, accessor, updatedCells);
        updatedCells.push({ cellKey: key, col, row, oldValue, newValue: this.values.get(key) });
      }
    }

    // Now recalc the ordered dependents
    this.recalcCells(recalcOrder, accessor, updatedCells, plan.cyclic);

    return this.recalcResult(updatedCells);
  }

  /**
   * An evaluator for formulas that live in no cell (conditional formats,
   * validation rules). Each formula is written for `anchor`; evaluating it
   * for another cell shifts its relative references by the distance from the
   * anchor, as copying the formula there would (`$` parts stay). Reads the
   * engine's current values; stores nothing. Make a new evaluator after the
   * data or formulas change: it caches parsed formulas and volatile results.
   */
  createDetachedEvaluator(accessor: IGridDataAccessor, options?: IDetachedEvaluationOptions): (formula: string, anchor: { col: number; row: number }, cell: { col: number; row: number }) => unknown {
    const baseContext = this.createContext(accessor);
    const proposed = options?.proposed;
    const changes = new Map([...(options?.changes ?? []), ...(proposed ? [proposed] : [])].map(change => [toCellKey(change.col, change.row), {
      ...change, ast: typeof change.value === 'string' && change.value.startsWith('=') ? this.parseFormula(change.value) : undefined,
    }] as const));
    const aliased = options?.sheet ? undefined : proposed?.alias ? proposed : options?.changes?.find(change => change.alias);
    const sheet = options?.sheet ?? (aliased?.alias && { name: aliased.alias.sheet, rowOffset: aliased.alias.row - aliased.row });
    const rowOffset = sheet?.rowOffset ?? 0;
    const localAddress = (addr: ICellAddress): ICellAddress => sheet && addr.sheet === sheet.name && addr.row >= rowOffset
      ? { ...addr, sheet: undefined, row: addr.row - rowOffset } : addr;
    const dependencies = (ast: ASTNode) => {
      const deps = extractDependencies(ast);
      if (sheet) {
        deps.cells = new Set([...deps.cells].map(key => { const addr = localAddress({ ...fromCellKey(key), absCol: false, absRow: false }); return toCellKey(addr.col, addr.row, addr.sheet); }));
        for (const range of deps.ranges) if (range.sheet === sheet.name) {
          range.sheet = undefined;
          range.minRow -= rowOffset; range.maxRow -= rowOffset;
        }
      }
      return deps;
    };
    const graph = changes.size > 1 ? new DependencyGraph() : this.depGraph;
    if (graph !== this.depGraph) {
      for (const [key, ast] of new Map([...this.parsedFormulas, ...[...changes].map(([key, change]) => [key, change.ast] as const)])) if (ast) {
        const deps = dependencies(ast);
        graph.setDependencies(key, deps.cells, deps.ranges);
      }
    }
    const circular = [...changes].some(([key, change]) => { if (!change.ast) return false; const deps = dependencies(change.ast); return graph.wouldCreateCycle(key, deps.cells, deps.ranges); });
    const localValues = new Map<string, unknown>();
    const localSpills = new SpillStore();
    const active = new Set<string>();
    const rawAccessor: IGridDataAccessor = { ...accessor, isCellOccupied: (col, row) => !changes.has(toCellKey(col, row)) && !!accessor.isCellOccupied?.(col, row), getCellValue: (col, row) => {
      const key = toCellKey(col, row);
      return changes.has(key) ? changes.get(key)?.value : accessor.getCellValue(col, row);
    } };
    const readCell = (address: ICellAddress): unknown => {
      const addr = localAddress(address);
      if (addr.sheet) return baseContext.getCellValue(addr);
      const key = toCellKey(addr.col, addr.row);
      if (active.has(key)) return new FormulaError('#CIRC!');
      const change = changes.get(key);
      const ast = change ? change.ast : this.parsedFormulas.get(key);
      if (change && !ast) return change.value;
      if (ast) {
        if (localValues.has(key)) return localValues.get(key);
        active.add(key);
        try {
          const result = this.evaluator.evaluate(ast, { ...context, currentCell: addr });
          const value = localSpills.put(key, result, rawAccessor, child => changes.get(child)?.ast != null || (!changes.has(child) && this.formulas.has(child)));
          localValues.set(key, value);
          return value;
        } finally { active.delete(key); }
      }
      const owner = localSpills.owners.get(key) ?? this.spills.owners.get(key);
      if (owner) {
        const origin = fromCellKey(owner);
        readCell({ ...origin, absCol: false, absRow: false });
        return localSpills.owners.has(key) ? localSpills.getValue(key) : rawAccessor.getCellValue(addr.col, addr.row);
      }
      return accessor.getCellValue(addr.col, addr.row);
    };
    const readRange = (range: ICellRange, preserveShape = false): unknown[][] => {
      const source = range.start.sheet ? this.sheetAccessors.get(range.start.sheet) : accessor;
      if (!source) return [[new FormulaError('#REF!')]];
      const minRow = Math.min(range.start.row, range.end.row), minCol = Math.min(range.start.col, range.end.col);
      let maxRow = Math.max(range.start.row, range.end.row), maxCol = Math.max(range.start.col, range.end.col);
      if (!preserveShape) {
        const extent = this.spillExtent();
        for (const spill of localSpills.ranges.values()) { extent.row = Math.max(extent.row, spill.endRow); extent.col = Math.max(extent.col, spill.endCol); }
        maxRow = Math.min(maxRow, Math.max(source.getRowCount() - 1, extent.row));
        maxCol = Math.min(maxCol, Math.max(source.getColumnCount() - 1, extent.col));
      }
      if ((maxRow - minRow + 1) * (maxCol - minCol + 1) > this.maxRangeCells) throw new FormulaError('#VALUE!', 'Range too large');
      const values: unknown[][] = [];
      for (let r = minRow; r <= maxRow; r++) {
        const row: unknown[] = [];
        for (let c = minCol; c <= maxCol; c++) row.push(readCell({ ...range.start, row: r, col: c }));
        values.push(row);
      }
      return values;
    };
    const spillRange = (address: ICellAddress): ICellRange | FormulaError => {
      const addr = localAddress(address);
      if (addr.sheet) return baseContext.getSpillRange?.(addr) ?? new FormulaError('#REF!');
      const value = readCell(addr);
      if (value instanceof FormulaError) return value;
      const spill = localSpills.ranges.get(toCellKey(addr.col, addr.row));
      return spill ? { start: { ...address, col: spill.anchorCol, row: address.row }, end: { ...address, col: spill.endCol, row: address.row + spill.endRow - spill.anchorRow } } : new FormulaError('#REF!', 'Cell has no spill range');
    };
    const context: IFormulaContext = changes.size ? {
      ...baseContext, getCellValue: readCell, getRangeValues: range => readRange(range), getArrayRangeValues: range => readRange(range, true),
      getSpillRange: spillRange, getSpillValues: addr => { const range = spillRange(addr); return range instanceof FormulaError ? range : readRange(range, true); },
      getCellFormula: address => { const addr = localAddress(address), key = toCellKey(addr.col, addr.row); return !addr.sheet && changes.has(key) ? changes.get(key)?.ast ? String(changes.get(key)?.value) : undefined : baseContext.getCellFormula?.(addr); },
    } : baseContext;
    const parsed = new Map<string, ASTNode>();
    return (formula, anchor, cell) => {
      if (circular) return new FormulaError('#CIRC!', 'Circular reference detected');
      let ast = parsed.get(formula);
      if (!ast) {
        ast = this.parseFormula(formula);
        parsed.set(formula, ast);
      }
      const shifted = shiftReferences(ast, cell.col - anchor.col, cell.row - anchor.row);
      try {
        for (const [key, change] of changes) if (change.ast) { const addr = fromCellKey(key); readCell({ ...addr, absCol: false, absRow: false }); }
        for (const [key, change] of changes) if (formula === change.value && cell.col === change.col && cell.row === change.row) active.add(key);
        const result = this.evaluator.evaluate(shifted, { ...context, currentCell: { col: cell.col, row: cell.row, absCol: false, absRow: false } });
        return Array.isArray(result) && !options?.preserveArrays ? result[0]?.[0] ?? null : result;
      } catch (err) {
        if (err instanceof FormulaError) return err;
        return new FormulaError('#VALUE!', err instanceof Error ? err.message : String(err));
      } finally { active.clear(); }
    };
  }

  /**
   * Clear all formulas and cached values.
   */
  clear(): void {
    this.spills.clear();
    this.pendingSpillChanges.clear();
    this.pendingSpillUpdates.length = 0;
    this.formulas.clear();
    this.parsedFormulas.clear();
    this.values.clear();
    this.depGraph.clear();
    this.dynamicReferenceCells.clear();
    this.volatileCells.clear();
    this.formulaRowsByCol.clear();
    this.maxFormulaRow = -1;
    this.maxFormulaCol = -1;
  }

  /**
   * Get all formula entries for serialization.
   */
  getAllFormulas(): Array<{ col: number; row: number; formula: string }> {
    const result: Array<{ col: number; row: number; formula: string }> = [];
    for (const [key, formula] of this.formulas) {
      const { col, row } = fromCellKey(key);
      result.push({ col, row, formula });
    }
    return result;
  }

  /**
   * Bulk-load formulas. Recalculates everything.
   */
  loadFormulas(
    formulas: Array<{ col: number; row: number; formula: string }>,
    accessor: IGridDataAccessor
  ): IRecalcResult {
    this.lastAccessor = accessor;
    const previousValues = new Map(this.values);
    for (const key of this.spills.owners.keys()) previousValues.set(key, this.spills.getValue(key));
    this.clear();

    // Parse and register all formulas first
    for (const { col, row, formula } of formulas) {
      const key = toCellKey(col, row);
      const ast = this.parseFormula(formula);
      const deps = extractDependencies(ast);
      this.rememberFormula(key, col, row, formula, ast, deps.volatile, deps.dynamicReferences);
      this.depGraph.setDependencies(key, deps.cells, deps.ranges);
    }

    // Evaluate all in dependency order, also reporting children removed by a
    // reload (host undo and structure edits use this path).
    const result = this.recalcAll(accessor);
    const updates = result.updatedCells.map(cell => ({ ...cell, oldValue: previousValues.get(cell.cellKey) }));
    const present = new Set(updates.map(cell => cell.cellKey));
    for (const [cellKey, oldValue] of previousValues) {
      if (present.has(cellKey)) continue;
      const { col, row } = fromCellKey(cellKey);
      updates.push({ cellKey, col, row, oldValue, newValue: this.getValue(col, row) });
    }
    return { ...result, updatedCells: updates };
  }

  // --- Named Ranges ---

  /**
   * Define a named range (e.g. "Revenue"  to  "A1:A10").
   */
  defineNamedRange(name: string, ref: string): void {
    this.namedRanges.set(name.toUpperCase(), ref);
    this.refreshNamedRanges();
  }

  /**
   * Remove a named range by name.
   */
  removeNamedRange(name: string): void {
    this.namedRanges.delete(name.toUpperCase());
    this.refreshNamedRanges();
  }

  /**
   * Get all named ranges as a Map (name  to  ref).
   */
  getNamedRanges(): ReadonlyMap<string, string> {
    return this.namedRanges;
  }

  private refreshNamedRanges(): void {
    for (const [key, formula] of this.formulas) {
      const ast = this.parseFormula(formula);
      const deps = extractDependencies(ast);
      this.parsedFormulas.set(key, ast);
      this.depGraph.setDependencies(key, deps.cells, deps.ranges);
      if (deps.dynamicReferences) this.dynamicReferenceCells.add(key);
      else this.dynamicReferenceCells.delete(key);
      if (deps.volatile) this.volatileCells.add(key);
      else this.volatileCells.delete(key);
    }
    if (this.lastAccessor) this.recalcAll(this.lastAccessor);
  }

  // --- Sheet Accessors ---

  /**
   * Register a data accessor for a named sheet (for cross-sheet references).
   */
  registerSheet(name: string, accessor: IGridDataAccessor): void {
    this.sheetAccessors.set(name, accessor);
  }

  /**
   * Unregister a sheet accessor.
   */
  unregisterSheet(name: string): void {
    this.sheetAccessors.delete(name);
  }

  /**
   * Recalculate every formula that reads from sheet `name`, plus their
   * dependents. Call after registering, replacing or unregistering a sheet,
   * or when its data changed and the changed cells aren't known.
   * `accessor` is the main grid's accessor.
   */
  onSheetChanged(name: string, accessor: IGridDataAccessor): IRecalcResult {
    this.lastAccessor = accessor;
    const readers: CellKey[] = [];
    for (const key of this.parsedFormulas.keys()) {
      if (this.volatileCells.has(key) || this.readsSheet(key, name)) readers.push(key);
    }
    if (readers.length === 0) return { updatedCells: [] };
    const plan = this.depGraph.getRecalcPlanBatch([], readers);
    const updatedCells: IRecalcResult['updatedCells'] = [];
    this.recalcCells(plan.order, accessor, updatedCells, plan.cyclic);
    return this.recalcResult(updatedCells);
  }

  // --- Formula Auditing ---

  /**
   * Get all cells that a cell depends on (deep, transitive precedents).
   */
  getPrecedents(col: number, row: number): IAuditEntry[] {
    const key = toCellKey(col, row);
    const result: IAuditEntry[] = [];
    const visited = new Set<CellKey>();
    const queue: CellKey[] = [];

    const enqueuePrecedents = (cell: CellKey): void => {
      for (const dep of this.depGraph.getDependencies(cell)) {
        if (!visited.has(dep)) {
          visited.add(dep);
          queue.push(dep);
        }
      }
      // Range references are expanded cell by cell, up to a bound, so audits
      // of huge ranges stay responsive.
      for (const range of this.depGraph.getRangeDependencies(cell)) {
        const cellCount = (range.maxRow - range.minRow + 1) * (range.maxCol - range.minCol + 1);
        if (cellCount > MAX_AUDIT_RANGE_CELLS) continue;
        for (let r = range.minRow; r <= range.maxRow; r++) {
          for (let c = range.minCol; c <= range.maxCol; c++) {
            const dep = toCellKey(c, r, range.sheet);
            if (!visited.has(dep)) {
              visited.add(dep);
              queue.push(dep);
            }
          }
        }
      }
    };

    // Seed with direct dependencies, then BFS
    enqueuePrecedents(key);
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      if (current === undefined) continue;
      const parsed = fromCellKey(current);
      result.push({
        cellKey: current,
        col: parsed.col,
        row: parsed.row,
        formula: this.formulas.get(current),
        value: this.values.has(current) ? this.values.get(current) : undefined,
      });
      enqueuePrecedents(current);
    }

    return result;
  }

  /**
   * Get all cells that depend on this cell (deep, transitive dependents).
   */
  getDependents(col: number, row: number): IAuditEntry[] {
    const key = toCellKey(col, row);
    const result: IAuditEntry[] = [];
    const visited = new Set<CellKey>();
    const queue: CellKey[] = [];

    // Seed with direct dependents
    const directDeps = this.depGraph.getDependents(key);
    for (const dep of directDeps) {
      if (!visited.has(dep)) {
        visited.add(dep);
        queue.push(dep);
      }
    }

    // BFS
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      if (current === undefined) continue;
      const parsed = fromCellKey(current);
      result.push({
        cellKey: current,
        col: parsed.col,
        row: parsed.row,
        formula: this.formulas.get(current),
        value: this.values.has(current) ? this.values.get(current) : undefined,
      });

      const deps = this.depGraph.getDependents(current);
      for (const dep of deps) {
        if (!visited.has(dep)) {
          visited.add(dep);
          queue.push(dep);
        }
      }
    }

    return result;
  }

  /**
   * Get a full audit trail for a cell: target + precedents + dependents.
   */
  getAuditTrail(col: number, row: number): IAuditTrail {
    const key = toCellKey(col, row);
    const target: IAuditEntry = {
      cellKey: key,
      col,
      row,
      formula: this.formulas.get(key),
      value: this.values.has(key) ? this.values.get(key) : undefined,
    };

    return {
      target,
      precedents: this.getPrecedents(col, row),
      dependents: this.getDependents(col, row),
    };
  }

  // --- Private methods ---

  private createContext(accessor: IGridDataAccessor, cyclic: ReadonlySet<CellKey> = EMPTY_CYCLIC): IFormulaContext {
    // Capture a single Date for all NOW()/TODAY() calls in this recalc cycle
    const contextNow = new Date();
    const evaluated = new Set<CellKey>();
    const active = new Set<CellKey>();
    const readCell = (addr: ICellAddress, fresh = false): unknown => {
        const key = toCellKey(addr.col, addr.row, addr.sheet);
        const ast = this.parsedFormulas.get(key);
        if (ast && (fresh || this.dynamicReferenceCells.has(key) || !this.values.has(key)) && !cyclic.has(key) && !evaluated.has(key)) {
          if (active.has(key)) return new FormulaError('#CIRC!', 'Dynamic circular reference');
          active.add(key);
          const value = this.safeEvaluate(ast, { ...context, getCellValue: context.getFreshCellValue, getRangeValues: context.getFreshRangeValues, getArrayRangeValues: context.getFreshArrayRangeValues }, key);
          active.delete(key);
          evaluated.add(key);
          this.applyResult(key, value, accessor);
        }
        if (this.spills.owners.has(key)) return this.spills.getValue(key);
        if (this.values.has(key)) return this.values.get(key);
        // Use sheet accessor if sheet is specified
        if (addr.sheet) {
          const sheetAccessor = this.sheetAccessors.get(addr.sheet);
          if (!sheetAccessor) return new FormulaError('#REF!', `Unknown sheet: ${addr.sheet}`);
          return sheetAccessor.getCellValue(addr.col, addr.row);
        }
        return accessor.getCellValue(addr.col, addr.row);
    };
    const readRange = (range: ICellRange, fresh = false, preserveShape = false): unknown[][] => {
        const result: unknown[][] = [];
        const sheet = range.start.sheet;
        const rangeAccessor = sheet
          ? this.sheetAccessors.get(sheet)
          : accessor;
        if (sheet && !rangeAccessor) {
          // Unknown sheet  -  return single-cell array with error
          return [[new FormulaError('#REF!', `Unknown sheet: ${sheet}`)]];
        }
        const minRow = Math.min(range.start.row, range.end.row);
        const minCol = Math.min(range.start.col, range.end.col);
        let maxRow = Math.max(range.start.row, range.end.row);
        let maxCol = Math.max(range.start.col, range.end.col);
        // Only materialise data/formula cells; logical dimensions stay in the AST.
        if (!preserveShape) {
        maxRow = Math.min(maxRow, Math.max(rangeAccessor?.getRowCount() ?? 0, sheet ? 0 : this.spillExtent().row + 1) - 1);
        maxCol = Math.min(maxCol, Math.max(rangeAccessor?.getColumnCount() ?? 0, sheet ? 0 : this.spillExtent().col + 1) - 1);
        }
        if (maxRow < minRow || maxCol < minCol) return [];
        const size = (maxRow - minRow + 1) * (maxCol - minCol + 1);
        if (size > this.maxRangeCells) throw new FormulaError('#VALUE!', 'Range too large');
        const formulaRows = Array.from({ length: maxCol - minCol + 1 }, (_, offset) => sheet ? undefined : this.formulaRowsByCol.get(minCol + offset));
        for (let r = minRow; r <= maxRow; r++) {
          const row: unknown[] = new Array(maxCol - minCol + 1);
          for (let c = minCol; c <= maxCol; c++) {
            row[c - minCol] = formulaRows[c - minCol]?.has(r) || (this.spills.owners.size > 0 && this.spills.owners.has(toCellKey(c, r, sheet)))
              ? readCell({ col: c, row: r, absCol: false, absRow: false, sheet }, fresh)
              : rangeAccessor?.getCellValue(c, r);
          }
          result.push(row);
        }
        return result;
    };
    const context: EngineContext = {
      getCellValue: addr => readCell(addr),
      getRangeValues: range => readRange(range),
      getArrayRangeValues: range => readRange(range, false, true),
      getFreshCellValue: addr => readCell(addr, true),
      getFreshRangeValues: range => readRange(range, true),
      getFreshArrayRangeValues: range => readRange(range, true, true),
      getSpillRange: addr => {
        const key = toCellKey(addr.col, addr.row, addr.sheet);
        const value = readCell(addr);
        if (value instanceof FormulaError) return value;
        const spill = addr.sheet ? this.sheetAccessors.get(addr.sheet)?.getSpillRange?.(addr.col, addr.row) : this.spills.ranges.get(key);
        if (!spill || spill.anchorCol !== addr.col || spill.anchorRow !== addr.row) return new FormulaError('#REF!', 'Cell has no spill range');
        return { start: { ...addr, col: spill.anchorCol, row: spill.anchorRow }, end: { ...addr, col: spill.endCol, row: spill.endRow } };
      },
      getSpillValues: addr => {
        const range = context.getSpillRange?.(addr);
        if (!range || range instanceof FormulaError) return range ?? new FormulaError('#REF!', 'Cell has no spill range');
        return addr.sheet ? readRange(range, false, true) : this.spills.arrays.get(toCellKey(addr.col, addr.row));
      },
      now: () => contextNow,
      getCellFormula: (addr: ICellAddress): string | undefined => {
        const key = toCellKey(addr.col, addr.row, addr.sheet);
        return this.formulas.get(key);
      },
      isRowHidden: (row: number, sheet?: string): boolean => {
        const rowAccessor = sheet ? this.sheetAccessors.get(sheet) : accessor;
        return rowAccessor?.isRowHidden?.(row) ?? false;
      },
    };
    return context;
  }

  private recalcCells(
    order: CellKey[],
    accessor: IGridDataAccessor,
    updatedCells: IRecalcResult['updatedCells'],
    cyclic: ReadonlySet<CellKey> = EMPTY_CYCLIC
  ): void {
    let pending = order;
    let cycleCells = cyclic;
    for (let round = 0; round <= this.formulas.size + 1; round++) {
      const context = this.createContext(accessor, cycleCells);
      const oldValues = new Map(pending.map(key => [key, this.values.get(key)]));
      for (const key of cycleCells) if (this.parsedFormulas.has(key)) this.applyResult(key, new FormulaError('#CIRC!', 'Circular reference detected'), accessor);
      for (const key of pending) {
        const ast = this.parsedFormulas.get(key);
        if (!ast) continue;
        const { col, row } = fromCellKey(key);
        const oldValue = oldValues.get(key);
        const result = cycleCells.has(key) ? new FormulaError('#CIRC!', 'Circular reference detected') : this.safeEvaluate(ast, context, key);
        this.applyResult(key, result, accessor, updatedCells);
        updatedCells.push({ cellKey: key, col, row, oldValue, newValue: this.values.get(key) });
      }
      const changed = [...this.pendingSpillChanges];
      this.pendingSpillChanges.clear();
      if (!changed.length) break;
      const plan = this.depGraph.getRecalcPlanBatch(changed, new Set([...this.spills.affected(changed, true), ...this.dynamicReferenceCells]));
      pending = plan.order;
      cycleCells = plan.cyclic;
      if (!pending.length) break;
    }
  }

  private recalcResult(updatedCells: IRecalcResult['updatedCells']): IRecalcResult {
    // Multiple dependency waves can touch the same cell. Report its first old
    // value and final new value, never intermediate caches.
    const cells = new Map<CellKey, IRecalcResult['updatedCells'][number]>();
    for (const cell of [...this.pendingSpillUpdates.splice(0), ...updatedCells]) {
      const previous = cells.get(cell.cellKey);
      cells.set(cell.cellKey, previous ? { ...cell, oldValue: previous.oldValue } : cell);
    }
    return { updatedCells: [...cells.values()], spillRanges: [...this.spills.ranges.values()] };
  }

  private spillExtent(): { col: number; row: number } {
    let col = this.maxFormulaCol, row = this.maxFormulaRow;
    for (const range of this.spills.ranges.values()) {
      col = Math.max(col, range.endCol); row = Math.max(row, range.endRow);
    }
    return { col, row };
  }

  private applyResult(key: CellKey, result: unknown, accessor: IGridDataAccessor, updates: IRecalcResult['updatedCells'] = this.pendingSpillUpdates): void {
    const old = new Map(this.spills.children(key).map(child => [child, this.spills.getValue(child)]));
    this.spills.remove(key);
    for (const child of old.keys()) if (!this.formulas.has(child)) this.depGraph.removeDependencies(child);
    const value = this.spills.put(key, result, accessor, child => this.formulas.has(child));
    this.values.set(key, value);
    const children = this.spills.children(key);
    for (const child of children) this.depGraph.setDependencies(child, new Set([key]));
    for (const child of new Set([...old.keys(), ...children])) {
      const oldValue = old.get(child), newValue = this.spills.getValue(child);
      if (!Object.is(oldValue, newValue)) {
        this.pendingSpillChanges.add(child);
        const { col, row } = fromCellKey(child);
        updates.push({ cellKey: child, col, row, oldValue, newValue });
      }
    }
  }

  private parseFormula(formula: string): ASTNode {
    // Strip leading '=' if present
    const expression = formula.startsWith('=') ? formula.slice(1) : formula;
    try {
      return parse(tokenize(expression), this.namedRanges);
    } catch (err) {
      const error = err instanceof FormulaError
        ? err
        : new FormulaError('#ERROR!', String(err));
      return { kind: 'error', error };
    }
  }

  /**
   * Evaluate without letting a throwing custom function or a runtime error
   * (e.g. out-of-memory RangeError) escape and leave the engine half-updated.
   */
  private safeEvaluate(ast: ASTNode, context: IFormulaContext, key?: CellKey): unknown {
    try {
      const address = key === undefined ? undefined : fromCellKey(key);
      if (key && this.dynamicReferenceCells.has(key) && 'getFreshCellValue' in context) {
        const freshContext = context as EngineContext;
        context = { ...context, getCellValue: freshContext.getFreshCellValue, getRangeValues: freshContext.getFreshRangeValues, getArrayRangeValues: freshContext.getFreshArrayRangeValues };
      }
      const result = this.evaluator.evaluate(ast, address ? { ...context, currentCell: { ...address, absCol: false, absRow: false } } : context);
      if (Array.isArray(result)) {
        const cells = result.reduce((sum, row) => sum + (Array.isArray(row) ? row.length : this.maxRangeCells + 1), 0);
        if (cells > this.maxRangeCells) return new FormulaError('#VALUE!', 'Array too large');
      }
      return result;
    } catch (err) {
      if (err instanceof FormulaError) return err;
      return new FormulaError('#VALUE!', err instanceof Error ? err.message : String(err));
    }
  }

  private rememberFormula(
    key: CellKey,
    col: number,
    row: number,
    formula: string,
    ast: ASTNode,
    volatile: boolean,
    dynamicReferences: boolean,
  ): void {
    this.maxFormulaRow = Math.max(this.maxFormulaRow, row);
    this.maxFormulaCol = Math.max(this.maxFormulaCol, col);
    this.formulas.set(key, formula);
    this.parsedFormulas.set(key, ast);
    if (dynamicReferences) this.dynamicReferenceCells.add(key);
    else this.dynamicReferenceCells.delete(key);
    if (volatile) this.volatileCells.add(key);
    else this.volatileCells.delete(key);
    let rows = this.formulaRowsByCol.get(col);
    if (!rows) {
      rows = new Set();
      this.formulaRowsByCol.set(col, rows);
    }
    rows.add(row);
  }

  private forgetFormula(key: CellKey, col: number, row: number): void {
    this.formulas.delete(key);
    this.parsedFormulas.delete(key);
    this.values.delete(key);
    this.dynamicReferenceCells.delete(key);
    this.volatileCells.delete(key);
    const rows = this.formulaRowsByCol.get(col);
    if (rows) {
      rows.delete(row);
      if (rows.size === 0) this.formulaRowsByCol.delete(col);
    }
  }

  /** Whether the formula at `key` references a cell or range on sheet `name`. */
  private readsSheet(key: CellKey, name: string): boolean {
    for (const dep of this.depGraph.getDependencies(key)) {
      if (fromCellKey(dep).sheet === name) return true;
    }
    for (const range of this.depGraph.getRangeDependencies(key)) {
      if (range.sheet === name) return true;
    }
    return false;
  }

  /** Volatile cells other than `key` (which was just evaluated). */
  private otherVolatiles(key: CellKey): CellKey[] {
    if (this.volatileCells.size === 0) return [];
    const out: CellKey[] = [];
    for (const k of this.volatileCells) if (k !== key) out.push(k);
    return out;
  }
}
