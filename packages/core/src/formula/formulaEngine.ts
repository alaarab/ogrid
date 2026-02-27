/**
 * FormulaEngine — orchestrates parser, evaluator, dependency graph, and formula storage.
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
import { createBuiltInFunctions } from './functions';
import { toCellKey, fromCellKey } from './cellAddressUtils';

/**
 * Extract all cell references from an AST node (for dependency tracking).
 */
function extractDependencies(node: ASTNode): Set<CellKey> {
  const deps = new Set<CellKey>();

  function walk(n: ASTNode): void {
    switch (n.kind) {
      case 'cellRef':
        deps.add(toCellKey(n.address.col, n.address.row, n.address.sheet));
        break;
      case 'range': {
        const sheet = n.start.sheet;
        const minRow = Math.min(n.start.row, n.end.row);
        const maxRow = Math.max(n.start.row, n.end.row);
        const minCol = Math.min(n.start.col, n.end.col);
        const maxCol = Math.max(n.start.col, n.end.col);
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            deps.add(toCellKey(c, r, sheet));
          }
        }
        break;
      }
      case 'functionCall':
        for (const arg of n.args) walk(arg);
        break;
      case 'binaryOp':
        walk(n.left);
        walk(n.right);
        break;
      case 'unaryOp':
        walk(n.operand);
        break;
      // number, string, boolean, error — no dependencies
    }
  }

  walk(node);
  return deps;
}

export class FormulaEngine {
  private readonly formulas = new Map<CellKey, string>();
  private readonly parsedFormulas = new Map<CellKey, ASTNode>();
  private readonly values = new Map<CellKey, unknown>();
  private readonly depGraph = new DependencyGraph();
  private readonly evaluator: FormulaEvaluator;
  private readonly maxChainLength: number;
  private readonly namedRanges = new Map<string, string>();
  private readonly sheetAccessors = new Map<string, IGridDataAccessor>();

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
    this.maxChainLength = config?.maxChainLength ?? 1000;
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
      this.formulas.delete(key);
      this.parsedFormulas.delete(key);
      this.values.delete(key);
      this.depGraph.removeDependencies(key);
      return {
        updatedCells: oldValue !== undefined
          ? [{ cellKey: key, col, row, oldValue, newValue: undefined }]
          : [],
      };
    }

    // Parse formula (strip leading '=' if present)
    const expression = formula.startsWith('=') ? formula.slice(1) : formula;
    let ast: ASTNode;
    try {
      const tokens = tokenize(expression);
      ast = parse(tokens, this.namedRanges);
    } catch (err) {
      const error = err instanceof FormulaError
        ? err
        : new FormulaError('#ERROR!', String(err));
      ast = { kind: 'error', error };
    }

    // Extract dependencies from AST
    const deps = extractDependencies(ast);

    // Check for circular references
    if (deps.has(key) || this.depGraph.wouldCreateCycle(key, deps)) {
      const oldValue = this.values.get(key);
      const circError = new FormulaError('#CIRC!', 'Circular reference detected');
      this.formulas.set(key, formula);
      this.parsedFormulas.set(key, ast);
      this.values.set(key, circError);
      this.depGraph.setDependencies(key, deps);
      return {
        updatedCells: [{ cellKey: key, col, row, oldValue, newValue: circError }],
      };
    }

    // Update dependency graph
    this.depGraph.setDependencies(key, deps);

    // Store formula and AST
    this.formulas.set(key, formula);
    this.parsedFormulas.set(key, ast);

    // Evaluate the formula
    const oldValue = this.values.get(key);
    const context = this.createContext(accessor);
    const newValue = this.evaluator.evaluate(ast, context);
    this.values.set(key, newValue);

    const updatedCells: IRecalcResult['updatedCells'] = [
      { cellKey: key, col, row, oldValue, newValue },
    ];

    // Cascade: recalculate all dependents
    const recalcOrder = this.depGraph.getRecalcOrder(key);
    this.recalcCells(recalcOrder, accessor, updatedCells);

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
    const recalcOrder = this.depGraph.getRecalcOrder(key);
    if (recalcOrder.length === 0) return { updatedCells: [] };

    const updatedCells: IRecalcResult['updatedCells'] = [];
    this.recalcCells(recalcOrder, accessor, updatedCells);
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
    const recalcOrder = this.depGraph.getRecalcOrderBatch(keys);
    if (recalcOrder.length === 0) return { updatedCells: [] };

    const updatedCells: IRecalcResult['updatedCells'] = [];
    this.recalcCells(recalcOrder, accessor, updatedCells);
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

    const recalcOrder = this.depGraph.getRecalcOrderBatch(allFormulaKeys);
    // Also recalc any formula cells that have no dependents (root formulas)
    const ordered = new Set(recalcOrder);
    for (const key of allFormulaKeys) {
      if (!ordered.has(key)) {
        const { col, row } = fromCellKey(key);
        const ast = this.parsedFormulas.get(key);
        if (!ast) continue;
        const oldValue = this.values.get(key);
        const newValue = this.evaluator.evaluate(ast, context);
        this.values.set(key, newValue);
        updatedCells.push({ cellKey: key, col, row, oldValue, newValue });
      }
    }

    // Now recalc the ordered dependents
    this.recalcCells(recalcOrder, accessor, updatedCells);

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
      const expression = formula.startsWith('=') ? formula.slice(1) : formula;
      let ast: ASTNode;
      try {
        const tokens = tokenize(expression);
        ast = parse(tokens, this.namedRanges);
      } catch (err) {
        const error = err instanceof FormulaError
          ? err
          : new FormulaError('#ERROR!', String(err));
        ast = { kind: 'error', error };
      }

      this.formulas.set(key, formula);
      this.parsedFormulas.set(key, ast);

      const deps = extractDependencies(ast);
      this.depGraph.setDependencies(key, deps);
    }

    // Evaluate all in dependency order
    return this.recalcAll(accessor);
  }

  // --- Named Ranges ---

  /**
   * Define a named range (e.g. "Revenue" → "A1:A10").
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
   * Get all named ranges as a Map (name → ref).
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

    // Seed with direct dependencies
    const directDeps = this.depGraph.getDependencies(key);
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
      const parsed = fromCellKey(current);
      result.push({
        cellKey: current,
        col: parsed.col,
        row: parsed.row,
        formula: this.formulas.get(current),
        value: this.values.has(current) ? this.values.get(current) : undefined,
      });

      const deps = this.depGraph.getDependencies(current);
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
          // Unknown sheet — return single-cell array with error
          return [[new FormulaError('#REF!', `Unknown sheet: ${sheet}`)]];
        }
        const minRow = Math.min(range.start.row, range.end.row);
        const maxRow = Math.max(range.start.row, range.end.row);
        const minCol = Math.min(range.start.col, range.end.col);
        const maxCol = Math.max(range.start.col, range.end.col);
        for (let r = minRow; r <= maxRow; r++) {
          const row: unknown[] = [];
          for (let c = minCol; c <= maxCol; c++) {
            const key = toCellKey(c, r, sheet);
            if (this.values.has(key)) {
              row.push(this.values.get(key));
            } else {
              row.push(rangeAccessor?.getCellValue(c, r));
            }
          }
          result.push(row);
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
    updatedCells: IRecalcResult['updatedCells']
  ): void {
    const context = this.createContext(accessor);
    let count = 0;

    for (const key of order) {
      if (count++ > this.maxChainLength) {
        // Safety limit — mark remaining as circular
        const { col, row } = fromCellKey(key);
        const oldValue = this.values.get(key);
        const circError = new FormulaError('#CIRC!', 'Dependency chain too long');
        this.values.set(key, circError);
        updatedCells.push({ cellKey: key, col, row, oldValue, newValue: circError });
        continue;
      }

      const ast = this.parsedFormulas.get(key);
      if (!ast) continue; // Not a formula cell — skip

      const { col, row } = fromCellKey(key);
      const oldValue = this.values.get(key);
      const newValue = this.evaluator.evaluate(ast, context);
      this.values.set(key, newValue);
      updatedCells.push({ cellKey: key, col, row, oldValue, newValue });
    }
  }
}
