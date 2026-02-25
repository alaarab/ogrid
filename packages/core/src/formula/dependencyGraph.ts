import type { CellKey } from './types';

const EMPTY_SET: ReadonlySet<CellKey> = Object.freeze(new Set<CellKey>());

export class DependencyGraph {
  /** cell -> set of cells it depends on (references in its formula) */
  private dependencies: Map<CellKey, Set<CellKey>> = new Map();

  /** cell -> set of cells that depend on it (reverse index) */
  private dependents: Map<CellKey, Set<CellKey>> = new Map();

  /**
   * Set the dependencies for a cell, replacing any previous ones.
   * Updates both the forward (dependencies) and reverse (dependents) maps.
   */
  setDependencies(cell: CellKey, deps: Set<CellKey>): void {
    // Remove old dependencies first (clean up reverse index)
    this.removeDependenciesInternal(cell);

    // Set new forward dependencies (take ownership — caller should not reuse `deps`)
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
  }

  /**
   * Remove all dependency information for a cell from both maps.
   */
  removeDependencies(cell: CellKey): void {
    this.removeDependenciesInternal(cell);

    // Also remove from dependents map as a key (cells that depend on this cell
    // still exist, but if the cell itself is removed, its dependents entry
    // for other cells referencing it is cleaned up by removeDependenciesInternal).
    // Here we also need to clean up any cell that listed `cell` as a dependent —
    // but that's about other cells' formulas referencing this cell, which is the
    // reverse direction. We remove the dependents entry for `cell` itself only
    // if no other cells reference it. Since removeDependenciesInternal handles
    // the forward→reverse cleanup, we just need to remove the dependents key.
    // But other cells might still depend on `cell`, so we keep that entry.
    // We do remove the forward dependencies entry.
    this.dependencies.delete(cell);
  }

  /**
   * Get all cells that directly or transitively depend on `changedCell`,
   * returned in topological order (a cell appears AFTER all cells it depends on).
   *
   * Uses Kahn's algorithm. If a cycle is detected, cycle participants are
   * appended at the end (the engine will assign #CIRC! to them).
   */
  getRecalcOrder(changedCell: CellKey): CellKey[] {
    return this.topologicalSort(new Set([changedCell]));
  }

  /**
   * Same as getRecalcOrder but for multiple changed cells.
   * Union of all transitive dependents, topologically sorted.
   */
  getRecalcOrderBatch(changedCells: CellKey[]): CellKey[] {
    return this.topologicalSort(new Set(changedCells));
  }

  /**
   * Check if adding dependencies from `cell` to `deps` would create a cycle.
   * DFS from each dep: if we can reach `cell`, it would create a cycle.
   */
  wouldCreateCycle(cell: CellKey, deps: Set<CellKey>): boolean {
    // If cell depends on itself, that's a cycle
    if (deps.has(cell)) {
      return true;
    }

    // For each proposed dependency, check if `cell` is reachable from it
    // by following the dependents chain (i.e., if dep transitively depends on cell)
    // Share a single visited Set across all deps to avoid redundant traversals
    const visited = new Set<CellKey>();
    for (const dep of deps) {
      if (this.canReach(dep, cell, visited)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Return direct dependents of a cell (cells whose formulas reference this cell).
   * Returns an empty set if none.
   */
  getDependents(cell: CellKey): ReadonlySet<CellKey> {
    return this.dependents.get(cell) ?? EMPTY_SET;
  }

  /**
   * Return direct dependencies of a cell (cells referenced in this cell's formula).
   * Returns an empty set if none.
   */
  getDependencies(cell: CellKey): ReadonlySet<CellKey> {
    return this.dependencies.get(cell) ?? EMPTY_SET;
  }

  /**
   * Clear both maps entirely.
   */
  clear(): void {
    this.dependencies.clear();
    this.dependents.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Remove `cell` from the forward dependencies map and clean up reverse
   * references in the dependents map.
   */
  private removeDependenciesInternal(cell: CellKey): void {
    const oldDeps = this.dependencies.get(cell);
    if (!oldDeps) {
      return;
    }

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

  /**
   * Iterative DFS: check if `target` is reachable from `start` by following
   * the dependency chain. Iterative to avoid stack overflow for deep chains.
   */
  private canReach(
    start: CellKey,
    target: CellKey,
    visited: Set<CellKey>
  ): boolean {
    if (start === target) return true;
    if (visited.has(start)) return false;

    const stack: CellKey[] = [start];
    visited.add(start);

    while (stack.length > 0) {
      const current = stack.pop()!;
      const deps = this.dependencies.get(current);
      if (!deps) continue;

      for (const dep of deps) {
        if (dep === target) return true;
        if (!visited.has(dep)) {
          visited.add(dep);
          stack.push(dep);
        }
      }
    }

    return false;
  }

  /**
   * Topological sort using Kahn's algorithm.
   *
   * 1. Collect all cells transitively dependent on the changed cell(s).
   * 2. Build in-degree map for these cells (count how many of their
   *    dependencies are in the affected set).
   * 3. Start with cells whose in-degree is 0 (only depend on unaffected
   *    cells or the changed cells themselves).
   * 4. Process queue: for each cell, reduce in-degree of its dependents,
   *    add to queue when in-degree reaches 0.
   * 5. If any cells remain unprocessed, they're in a cycle — append them
   *    at the end (engine marks as #CIRC!).
   */
  private topologicalSort(changedCells: Set<CellKey>): CellKey[] {
    // Step 1: Collect all transitively affected cells via BFS on dependents
    const affected = new Set<CellKey>();
    const bfsQueue: CellKey[] = [];

    for (const changed of changedCells) {
      const directDependents = this.dependents.get(changed);
      if (directDependents) {
        for (const dep of directDependents) {
          if (!affected.has(dep)) {
            affected.add(dep);
            bfsQueue.push(dep);
          }
        }
      }
    }

    let head = 0;
    while (head < bfsQueue.length) {
      const current = bfsQueue[head++];
      const currentDependents = this.dependents.get(current);
      if (currentDependents) {
        for (const dep of currentDependents) {
          if (!affected.has(dep)) {
            affected.add(dep);
            bfsQueue.push(dep);
          }
        }
      }
    }

    if (affected.size === 0) {
      return [];
    }

    // Step 2: Build in-degree map for affected cells
    // In-degree = number of dependencies that are ALSO in the affected set
    // (dependencies on changed cells or unaffected cells count as 0)
    const inDegree = new Map<CellKey, number>();

    for (const cell of affected) {
      let degree = 0;
      const deps = this.dependencies.get(cell);
      if (deps) {
        for (const dep of deps) {
          if (affected.has(dep)) {
            degree++;
          }
        }
      }
      inDegree.set(cell, degree);
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
      result.push(cell);

      const cellDependents = this.dependents.get(cell);
      if (cellDependents) {
        for (const dependent of cellDependents) {
          if (affected.has(dependent)) {
            const newDegree = inDegree.get(dependent)! - 1;
            inDegree.set(dependent, newDegree);
            if (newDegree === 0) {
              queue.push(dependent);
            }
          }
        }
      }
    }

    // Step 5: Any remaining cells are in a cycle — append at the end
    if (result.length < affected.size) {
      const resultSet = new Set(result);
      for (const cell of affected) {
        if (!resultSet.has(cell)) {
          result.push(cell);
        }
      }
    }

    return result;
  }
}
