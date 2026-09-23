import type { CellKey, IRecalcPlan } from './types';
import { fromCellKey } from './cellAddressUtils';

const EMPTY_SET: ReadonlySet<CellKey> = Object.freeze(new Set<CellKey>());

/**
 * A rectangular range a formula depends on, kept as a range rather than
 * expanded into one dependency per cell: `=SUM(A1:A100000)` is one entry.
 */
export interface IRangeDependency {
  sheet?: string;
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

interface RangeEntry {
  owner: CellKey;
  range: IRangeDependency;
}

/** Ranges spanning more columns than this skip the per-column index. */
const MAX_INDEXED_COL_SPAN = 64;

function rangeContains(range: IRangeDependency, col: number, row: number, sheet: string | undefined): boolean {
  return (
    (range.sheet ?? undefined) === sheet &&
    col >= range.minCol && col <= range.maxCol &&
    row >= range.minRow && row <= range.maxRow
  );
}

export class DependencyGraph {
  /** cell -> set of cells it depends on (single-cell references in its formula) */
  private dependencies: Map<CellKey, Set<CellKey>> = new Map();

  /** cell -> set of cells that depend on it (reverse index of `dependencies`) */
  private dependents: Map<CellKey, Set<CellKey>> = new Map();

  /** cell -> ranges it depends on */
  private rangeDependencies: Map<CellKey, RangeEntry[]> = new Map();

  /** sheet ('' = main) -> column -> range entries covering that column */
  private rangesByColumn: Map<string, Map<number, Set<RangeEntry>>> = new Map();

  /** sheet ('' = main) -> range entries too wide to index per column */
  private wideRanges: Map<string, Set<RangeEntry>> = new Map();

  /**
   * Set the dependencies for a cell, replacing any previous ones.
   * `deps` are single-cell references; `ranges` are range references.
   */
  setDependencies(cell: CellKey, deps: Set<CellKey>, ranges: readonly IRangeDependency[] = []): void {
    // Remove old dependencies first (clean up reverse index)
    this.removeDependenciesInternal(cell);

    // Set new forward dependencies (take ownership  -  caller should not reuse `deps`)
    this.dependencies.set(cell, deps);

    // Update reverse index: for each dep, record that `cell` depends on it
    for (const dep of deps) {
      let depSet = this.dependents.get(dep);
      if (!depSet) {
        depSet = new Set();
        this.dependents.set(dep, depSet);
      }
      depSet.add(cell);
    }

    if (ranges.length > 0) {
      const entries = ranges.map((range) => ({ owner: cell, range }));
      this.rangeDependencies.set(cell, entries);
      for (const entry of entries) this.indexRange(entry);
    }
  }

  /**
   * Remove all dependency information for a cell. Cells that reference
   * `cell` keep their edges: their formulas still point at it.
   */
  removeDependencies(cell: CellKey): void {
    this.removeDependenciesInternal(cell);
  }

  /**
   * Get all cells that directly or transitively depend on `changedCell`,
   * returned in topological order (a cell appears AFTER all cells it depends on).
   *
   * Uses Kahn's algorithm. If a cycle is detected, cycle participants are
   * appended at the end (the engine will assign #CIRC! to them).
   */
  getRecalcOrder(changedCell: CellKey): CellKey[] {
    return this.topologicalSort(new Set([changedCell])).order;
  }

  /**
   * Like `getRecalcOrder`, but also reports which cells are genuine cycle
   * participants so the caller can mark exactly those #CIRC!.
   */
  getRecalcPlan(changedCell: CellKey): IRecalcPlan {
    return this.topologicalSort(new Set([changedCell]));
  }

  /**
   * Same as getRecalcOrder but for multiple changed cells.
   * Union of all transitive dependents, topologically sorted.
   */
  getRecalcOrderBatch(changedCells: CellKey[]): CellKey[] {
    return this.topologicalSort(new Set(changedCells)).order;
  }

  /**
   * Like `getRecalcOrderBatch`, but also reports cycle participants.
   * `alsoRecalc` cells (e.g. volatile formulas) are included in the plan even
   * when nothing they reference changed, together with their dependents.
   */
  getRecalcPlanBatch(changedCells: CellKey[], alsoRecalc?: Iterable<CellKey>): IRecalcPlan {
    return this.topologicalSort(new Set(changedCells), alsoRecalc);
  }

  /**
   * Check if giving `cell` these dependencies would create a cycle, i.e. if
   * any proposed dependency is `cell` itself or already depends on `cell`.
   */
  wouldCreateCycle(cell: CellKey, deps: Set<CellKey>, ranges: readonly IRangeDependency[] = []): boolean {
    const hits = (key: CellKey): boolean => {
      if (deps.has(key)) return true;
      if (ranges.length === 0) return false;
      const { col, row, sheet } = fromCellKey(key);
      for (const range of ranges) {
        if (rangeContains(range, col, row, sheet)) return true;
      }
      return false;
    };

    if (hits(cell)) return true;

    // Walk everything that transitively depends on `cell`.
    const visited = new Set<CellKey>([cell]);
    const stack: CellKey[] = [cell];
    while (stack.length > 0) {
      const current = stack.pop() as CellKey;
      for (const dependent of this.collectDependents(current)) {
        if (visited.has(dependent)) continue;
        if (hits(dependent)) return true;
        visited.add(dependent);
        stack.push(dependent);
      }
    }
    return false;
  }

  /**
   * Return direct dependents of a cell: cells whose formulas reference it,
   * either directly or through a range. Returns an empty set if none.
   */
  getDependents(cell: CellKey): ReadonlySet<CellKey> {
    const direct = this.dependents.get(cell);
    const viaRanges = this.rangeDependentsOf(cell);
    if (viaRanges.length === 0) return direct ?? EMPTY_SET;
    const all = new Set<CellKey>(direct);
    for (const owner of viaRanges) all.add(owner);
    return all;
  }

  /**
   * Return direct single-cell dependencies of a cell (cells referenced in
   * this cell's formula). Range references are in `getRangeDependencies`.
   */
  getDependencies(cell: CellKey): ReadonlySet<CellKey> {
    return this.dependencies.get(cell) ?? EMPTY_SET;
  }

  /** Return the range references of a cell's formula. */
  getRangeDependencies(cell: CellKey): readonly IRangeDependency[] {
    const entries = this.rangeDependencies.get(cell);
    return entries ? entries.map((e) => e.range) : [];
  }

  /**
   * Clear all maps entirely.
   */
  clear(): void {
    this.dependencies.clear();
    this.dependents.clear();
    this.rangeDependencies.clear();
    this.rangesByColumn.clear();
    this.wideRanges.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private indexRange(entry: RangeEntry): void {
    const sheetKey = entry.range.sheet ?? '';
    const { minCol, maxCol } = entry.range;
    if (maxCol - minCol + 1 > MAX_INDEXED_COL_SPAN) {
      let wide = this.wideRanges.get(sheetKey);
      if (!wide) {
        wide = new Set();
        this.wideRanges.set(sheetKey, wide);
      }
      wide.add(entry);
      return;
    }
    let byCol = this.rangesByColumn.get(sheetKey);
    if (!byCol) {
      byCol = new Map();
      this.rangesByColumn.set(sheetKey, byCol);
    }
    for (let c = minCol; c <= maxCol; c++) {
      let set = byCol.get(c);
      if (!set) {
        set = new Set();
        byCol.set(c, set);
      }
      set.add(entry);
    }
  }

  private unindexRange(entry: RangeEntry): void {
    const sheetKey = entry.range.sheet ?? '';
    const { minCol, maxCol } = entry.range;
    if (maxCol - minCol + 1 > MAX_INDEXED_COL_SPAN) {
      const wide = this.wideRanges.get(sheetKey);
      wide?.delete(entry);
      if (wide && wide.size === 0) this.wideRanges.delete(sheetKey);
      return;
    }
    const byCol = this.rangesByColumn.get(sheetKey);
    if (!byCol) return;
    for (let c = minCol; c <= maxCol; c++) {
      const set = byCol.get(c);
      if (!set) continue;
      set.delete(entry);
      if (set.size === 0) byCol.delete(c);
    }
    if (byCol.size === 0) this.rangesByColumn.delete(sheetKey);
  }

  /** Owners of ranges that contain `cell`. */
  private rangeDependentsOf(cell: CellKey): CellKey[] {
    if (this.rangeDependencies.size === 0) return [];
    const { col, row, sheet } = fromCellKey(cell);
    const sheetKey = sheet ?? '';
    const owners: CellKey[] = [];
    const candidates = this.rangesByColumn.get(sheetKey)?.get(col);
    if (candidates) {
      for (const entry of candidates) {
        if (row >= entry.range.minRow && row <= entry.range.maxRow) owners.push(entry.owner);
      }
    }
    const wide = this.wideRanges.get(sheetKey);
    if (wide) {
      for (const entry of wide) {
        if (rangeContains(entry.range, col, row, sheet)) owners.push(entry.owner);
      }
    }
    return owners;
  }

  /** Direct dependents (cell refs + ranges), deduplicated, as an array. */
  private collectDependents(cell: CellKey): CellKey[] {
    const direct = this.dependents.get(cell);
    const viaRanges = this.rangeDependentsOf(cell);
    if (viaRanges.length === 0) return direct ? Array.from(direct) : [];
    const all = new Set<CellKey>(direct);
    for (const owner of viaRanges) all.add(owner);
    return Array.from(all);
  }

  /**
   * Remove `cell`'s forward dependencies (cells and ranges) and clean up the
   * reverse indexes.
   */
  private removeDependenciesInternal(cell: CellKey): void {
    const oldDeps = this.dependencies.get(cell);
    if (oldDeps) {
      // For each old dependency, remove `cell` from its dependents set
      for (const oldDep of oldDeps) {
        const depSet = this.dependents.get(oldDep);
        if (depSet) {
          depSet.delete(cell);
          if (depSet.size === 0) {
            this.dependents.delete(oldDep);
          }
        }
      }
      this.dependencies.delete(cell);
    }

    const oldRanges = this.rangeDependencies.get(cell);
    if (oldRanges) {
      for (const entry of oldRanges) this.unindexRange(entry);
      this.rangeDependencies.delete(cell);
    }
  }

  /**
   * Topological sort using Kahn's algorithm.
   *
   * 1. Collect all cells transitively dependent on the changed cell(s)
   *    (plus any `alsoRecalc` cells and their dependents).
   * 2. Count, for each affected cell, how many affected cells it depends on.
   * 3. Start with cells whose count is 0 (only depend on unaffected
   *    cells or the changed cells themselves).
   * 4. Process queue: for each cell, reduce the count of its dependents,
   *    add to queue when it reaches 0.
   * 5. If any cells remain unprocessed, they're in a cycle  -  append them
   *    at the end (engine marks as #CIRC!).
   */
  private topologicalSort(changedCells: Set<CellKey>, alsoRecalc?: Iterable<CellKey>): IRecalcPlan {
    // Direct dependents are computed once per visited cell and reused below.
    const dependentsOf = new Map<CellKey, CellKey[]>();
    const getDeps = (cell: CellKey): CellKey[] => {
      let list = dependentsOf.get(cell);
      if (!list) {
        list = this.collectDependents(cell);
        dependentsOf.set(cell, list);
      }
      return list;
    };

    // Step 1: Collect all transitively affected cells via BFS on dependents
    const affected = new Set<CellKey>();
    const bfsQueue: CellKey[] = [];
    if (alsoRecalc) {
      for (const cell of alsoRecalc) {
        if (!affected.has(cell)) {
          affected.add(cell);
          bfsQueue.push(cell);
        }
      }
    }
    for (const changed of changedCells) {
      for (const dep of getDeps(changed)) {
        if (!affected.has(dep)) {
          affected.add(dep);
          bfsQueue.push(dep);
        }
      }
    }

    let head = 0;
    while (head < bfsQueue.length) {
      const current = bfsQueue[head++];
      if (current === undefined) continue;
      for (const dep of getDeps(current)) {
        if (!affected.has(dep)) {
          affected.add(dep);
          bfsQueue.push(dep);
        }
      }
    }

    if (affected.size === 0) {
      return { order: [], cyclic: new Set<CellKey>() };
    }

    // Step 2: in-degree = number of affected cells each affected cell depends on
    const inDegree = new Map<CellKey, number>();
    for (const cell of affected) inDegree.set(cell, 0);
    for (const cell of affected) {
      for (const dependent of getDeps(cell)) {
        if (affected.has(dependent)) {
          inDegree.set(dependent, (inDegree.get(dependent) ?? 0) + 1);
        }
      }
    }

    // Step 3: Start with cells whose in-degree is 0
    const queue: CellKey[] = [];
    for (const [cell, degree] of inDegree) {
      if (degree === 0) {
        queue.push(cell);
      }
    }

    // Step 4: Process queue (Kahn's algorithm)
    const result: CellKey[] = [];
    let queueHead = 0;

    while (queueHead < queue.length) {
      const cell = queue[queueHead++];
      if (cell === undefined) continue;
      result.push(cell);

      for (const dependent of getDeps(cell)) {
        if (affected.has(dependent)) {
          const newDegree = (inDegree.get(dependent) ?? 0) - 1;
          inDegree.set(dependent, newDegree);
          if (newDegree === 0) {
            queue.push(dependent);
          }
        }
      }
    }

    // Step 5: Any remaining cells are in a cycle  -  append at the end
    const cyclic = new Set<CellKey>();
    if (result.length < affected.size) {
      const resultSet = new Set(result);
      for (const cell of affected) {
        if (!resultSet.has(cell)) {
          result.push(cell);
          cyclic.add(cell);
        }
      }
    }

    return { order: result, cyclic };
  }
}
