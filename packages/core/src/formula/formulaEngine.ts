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
} from './types';
import { FormulaError } from './types';
import { tokenize } from './tokenizer';
import { parse } from './parser';
import { FormulaEvaluator } from './evaluator';
import { DependencyGraph } from './dependencyGraph';
import type { IRangeDependency } from './dependencyGraph';
import { createBuiltInFunctions } from './functions';
import { toCellKey, fromCellKey } from './cellAddressUtils';

/** Shared empty cycle set, so recalcCells can default without allocating. */
const EMPTY_CYCLIC: ReadonlySet<CellKey> = Object.freeze(new Set<CellKey>());

/**
 * Functions whose references are computed at evaluation time, so the
 * dependency graph can't see them. Formulas using them recalc on every change.
 */
const VOLATILE_FUNCTIONS: ReadonlySet<string> = new Set(['INDIRECT', 'OFFSET']);

/** Ranges larger than this are clamped to the grid's data bounds. */
const MAX_UNCLAMPED_RANGE_CELLS = 1_000_000;

/** Upper bound on cells read for one range after clamping to the grid. */
export const MAX_RANGE_CELLS = 5_000_000;

/** Upper bound on range cells expanded when listing audit precedents. */
const MAX_AUDIT_RANGE_CELLS = 10_000;

interface FormulaDependencies {
  cells: Set<CellKey>;
  ranges: IRangeDependency[];
  volatile: boolean;
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

  function walk(n: ASTNode): void {
    switch (n.kind) {
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
        if (VOLATILE_FUNCTIONS.has(n.name.toUpperCase())) volatile = true;
        for (const arg of n.args) walk(arg);
        break;
      case 'binaryOp':
        walk(n.left);
        walk(n.right);
        break;
      case 'unaryOp':
        walk(n.operand);
        break;
      // number, string, boolean, error  -  no dependencies
    }
  }

  walk(node);
  return { cells, ranges, volatile };
}

export class FormulaEngine {
  private readonly formulas = new Map<CellKey, string>();
  private readonly parsedFormulas = new Map<CellKey, ASTNode>();
  private readonly values = new Map<CellKey, unknown>();
  private readonly depGraph = new DependencyGraph();
  private readonly evaluator: FormulaEvaluator;
  private readonly namedRanges = new Map<string, string>();
  private readonly sheetAccessors = new Map<string, IGridDataAccessor>();
  /** Formula cells using INDIRECT/OFFSET; recalculated on every change. */
  private readonly volatileCells = new Set<CellKey>();
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
    this.evaluator = new FormulaEvaluator(builtIns);
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
    const key = toCellKey(col, row);

    if (formula === null || formula === '') {
      // Clear formula
      const oldValue = this.values.get(key);
      // Capture the cascade before mutating the graph, then recalculate the
      // dependents  -  otherwise every cell referencing this one keeps the
      // value it had while the formula still existed.
      const plan = this.depGraph.getRecalcPlanBatch([key], this.volatileCells);
      this.forgetFormula(key, col, row);
      this.depGraph.removeDependencies(key);
      const updatedCells: IRecalcResult['updatedCells'] = oldValue !== undefined
        ? [{ cellKey: key, col, row, oldValue, newValue: undefined }]
        : [];
      this.recalcCells(plan.order, accessor, updatedCells, plan.cyclic);
      return { updatedCells };
    }

    const ast = this.parseFormula(formula);
    const deps = extractDependencies(ast);
    const oldValue = this.values.get(key);

    // Circular reference: store the formula as #CIRC!, then recalc its
    // dependents so cells downstream don't keep values from before the cycle.
    if (this.depGraph.wouldCreateCycle(key, deps.cells, deps.ranges)) {
      const circError = new FormulaError('#CIRC!', 'Circular reference detected');
      this.rememberFormula(key, col, row, formula, ast, deps.volatile);
      this.values.set(key, circError);
      this.depGraph.setDependencies(key, deps.cells, deps.ranges);
      const updatedCells: IRecalcResult['updatedCells'] = [
        { cellKey: key, col, row, oldValue, newValue: circError },
      ];
      const plan = this.depGraph.getRecalcPlan(key);
      this.recalcCells(plan.order.filter((k) => k !== key), accessor, updatedCells, plan.cyclic);
      return { updatedCells };
    }

    this.depGraph.setDependencies(key, deps.cells, deps.ranges);
    this.rememberFormula(key, col, row, formula, ast, deps.volatile);

    // Evaluate the formula
    const context = this.createContext(accessor);
    const newValue = this.safeEvaluate(ast, context);
    this.values.set(key, newValue);

    const updatedCells: IRecalcResult['updatedCells'] = [
      { cellKey: key, col, row, oldValue, newValue },
    ];

    // Cascade: recalculate all dependents (and volatile formulas)
    const plan = this.depGraph.getRecalcPlanBatch([key], this.otherVolatiles(key));
    this.recalcCells(plan.order, accessor, updatedCells, plan.cyclic);

    return { updatedCells };
  }

  /**
   * Notify the engine that a non-formula cell's value changed.
   */
  onCellChanged(
    col: number,
    row: number,
    accessor: IGridDataAccessor
  ): IRecalcResult {
    const key = toCellKey(col, row);
    const plan = this.depGraph.getRecalcPlanBatch([key], this.volatileCells);
    if (plan.order.length === 0) return { updatedCells: [] };

    const updatedCells: IRecalcResult['updatedCells'] = [];
    this.recalcCells(plan.order, accessor, updatedCells, plan.cyclic);
    return { updatedCells };
  }

  /**
   * Batch notify: multiple cells changed.
   */
  onCellsChanged(
    cells: Array<{ col: number; row: number }>,
    accessor: IGridDataAccessor
  ): IRecalcResult {
    const keys = cells.map(c => toCellKey(c.col, c.row));
    const plan = this.depGraph.getRecalcPlanBatch(keys, this.volatileCells);
    if (plan.order.length === 0) return { updatedCells: [] };

    const updatedCells: IRecalcResult['updatedCells'] = [];
    this.recalcCells(plan.order, accessor, updatedCells, plan.cyclic);
    return { updatedCells };
  }

  /**
   * Get the current computed value for a cell.
   */
  getValue(col: number, row: number): unknown | undefined {
    return this.values.get(toCellKey(col, row));
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
    const updatedCells: IRecalcResult['updatedCells'] = [];
    const context = this.createContext(accessor);

    // Get all formula cells and recalc in dependency order
    if (this.formulas.size === 0) return { updatedCells };
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
        const newValue = this.safeEvaluate(ast, context);
        this.values.set(key, newValue);
        updatedCells.push({ cellKey: key, col, row, oldValue, newValue });
      }
    }

    // Now recalc the ordered dependents
    this.recalcCells(recalcOrder, accessor, updatedCells, plan.cyclic);

    return { updatedCells };
  }

  /**
   * Clear all formulas and cached values.
   */
  clear(): void {
    this.formulas.clear();
    this.parsedFormulas.clear();
    this.values.clear();
    this.depGraph.clear();
    this.volatileCells.clear();
    this.formulaRowsByCol.clear();
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
    this.clear();

    // Parse and register all formulas first
    for (const { col, row, formula } of formulas) {
      const key = toCellKey(col, row);
      const ast = this.parseFormula(formula);
      const deps = extractDependencies(ast);
      this.rememberFormula(key, col, row, formula, ast, deps.volatile);
      this.depGraph.setDependencies(key, deps.cells, deps.ranges);
    }

    // Evaluate all in dependency order
    return this.recalcAll(accessor);
  }

  // --- Named Ranges ---

  /**
   * Define a named range (e.g. "Revenue"  to  "A1:A10").
   */
  defineNamedRange(name: string, ref: string): void {
    this.namedRanges.set(name.toUpperCase(), ref);
  }

  /**
   * Remove a named range by name.
   */
  removeNamedRange(name: string): void {
    this.namedRanges.delete(name.toUpperCase());
  }

  /**
   * Get all named ranges as a Map (name  to  ref).
   */
  getNamedRanges(): ReadonlyMap<string, string> {
    return this.namedRanges;
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

  private createContext(accessor: IGridDataAccessor): IFormulaContext {
    // Capture a single Date for all NOW()/TODAY() calls in this recalc cycle
    const contextNow = new Date();
    return {
      getCellValue: (addr: ICellAddress): unknown => {
        const key = toCellKey(addr.col, addr.row, addr.sheet);
        if (this.values.has(key)) return this.values.get(key);
        // Use sheet accessor if sheet is specified
        if (addr.sheet) {
          const sheetAccessor = this.sheetAccessors.get(addr.sheet);
          if (!sheetAccessor) return new FormulaError('#REF!', `Unknown sheet: ${addr.sheet}`);
          return sheetAccessor.getCellValue(addr.col, addr.row);
        }
        return accessor.getCellValue(addr.col, addr.row);
      },
      getRangeValues: (range: ICellRange): unknown[][] => {
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
        // Huge ranges (=SUM(A1:XFD1048576)) are clamped to the grid, since
        // cells past the data are empty and reading them one by one would
        // hang the page. Ordinary ranges keep their full shape so functions
        // like COUNTBLANK and INDEX see the cells past the last data row.
        if ((maxRow - minRow + 1) * (maxCol - minCol + 1) > MAX_UNCLAMPED_RANGE_CELLS) {
          maxRow = Math.min(maxRow, (rangeAccessor?.getRowCount() ?? 0) - 1);
          maxCol = Math.min(maxCol, (rangeAccessor?.getColumnCount() ?? 0) - 1);
          if (maxRow < minRow || maxCol < minCol) return [[]];
          if ((maxRow - minRow + 1) * (maxCol - minCol + 1) > MAX_RANGE_CELLS) {
            return [[new FormulaError('#VALUE!', 'Range too large')]];
          }
        }
        for (let r = minRow; r <= maxRow; r++) {
          const row: unknown[] = new Array(maxCol - minCol + 1);
          for (let c = minCol; c <= maxCol; c++) {
            row[c - minCol] = rangeAccessor?.getCellValue(c, r);
          }
          result.push(row);
        }
        // Overlay computed formula values (main sheet only: formulas live there).
        if (!sheet) {
          for (let c = minCol; c <= maxCol; c++) {
            const rows = this.formulaRowsByCol.get(c);
            if (!rows) continue;
            for (const r of rows) {
              if (r < minRow || r > maxRow) continue;
              const key = toCellKey(c, r);
              const target = result[r - minRow];
              if (target && this.values.has(key)) target[c - minCol] = this.values.get(key);
            }
          }
        }
        return result;
      },
      now: () => contextNow,
      getCellFormula: (addr: ICellAddress): string | undefined => {
        const key = toCellKey(addr.col, addr.row, addr.sheet);
        return this.formulas.get(key);
      },
    };
  }

  private recalcCells(
    order: CellKey[],
    accessor: IGridDataAccessor,
    updatedCells: IRecalcResult['updatedCells'],
    cyclic: ReadonlySet<CellKey> = EMPTY_CYCLIC
  ): void {
    const context = this.createContext(accessor);

    for (const key of order) {
      if (cyclic.has(key)) {
        // Genuine cycle participant, as reported by the topological sort.
        const { col, row } = fromCellKey(key);
        const oldValue = this.values.get(key);
        const circError = new FormulaError('#CIRC!', 'Circular reference detected');
        this.values.set(key, circError);
        updatedCells.push({ cellKey: key, col, row, oldValue, newValue: circError });
        continue;
      }

      const ast = this.parsedFormulas.get(key);
      if (!ast) continue; // Not a formula cell  -  skip

      const { col, row } = fromCellKey(key);
      const oldValue = this.values.get(key);
      const newValue = this.safeEvaluate(ast, context);
      this.values.set(key, newValue);
      updatedCells.push({ cellKey: key, col, row, oldValue, newValue });
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
  private safeEvaluate(ast: ASTNode, context: IFormulaContext): unknown {
    try {
      return this.evaluator.evaluate(ast, context);
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
  ): void {
    this.formulas.set(key, formula);
    this.parsedFormulas.set(key, ast);
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
    this.volatileCells.delete(key);
    const rows = this.formulaRowsByCol.get(col);
    if (rows) {
      rows.delete(row);
      if (rows.size === 0) this.formulaRowsByCol.delete(col);
    }
  }

  /** Volatile cells other than `key` (which was just evaluated). */
  private otherVolatiles(key: CellKey): CellKey[] {
    if (this.volatileCells.size === 0) return [];
    const out: CellKey[] = [];
    for (const k of this.volatileCells) if (k !== key) out.push(k);
    return out;
  }
}
