import { DependencyGraph } from '../dependencyGraph';

// ---------------------------------------------------------------------------
// setDependencies
// ---------------------------------------------------------------------------

describe('DependencyGraph  -  setDependencies', () => {
  it('creates a simple A depends on B relationship', () => {
    const g = new DependencyGraph();
    g.setDependencies('A', new Set(['B']));

    expect(g.getDependencies('A')).toEqual(new Set(['B']));
    expect(g.getDependents('B')).toEqual(new Set(['A']));
  });

  it('supports multiple dependencies', () => {
    const g = new DependencyGraph();
    g.setDependencies('C', new Set(['A', 'B']));

    expect(g.getDependencies('C')).toEqual(new Set(['A', 'B']));
    expect(g.getDependents('A')).toEqual(new Set(['C']));
    expect(g.getDependents('B')).toEqual(new Set(['C']));
  });

  it('replaces existing dependencies and cleans up reverse index', () => {
    const g = new DependencyGraph();
    g.setDependencies('A', new Set(['B', 'C']));
    g.setDependencies('A', new Set(['D']));

    expect(g.getDependencies('A')).toEqual(new Set(['D']));
    expect(g.getDependents('D')).toEqual(new Set(['A']));
    // B and C should no longer list A as a dependent
    expect(g.getDependents('B').size).toBe(0);
    expect(g.getDependents('C').size).toBe(0);
  });

  it('handles setting empty dependencies', () => {
    const g = new DependencyGraph();
    g.setDependencies('A', new Set(['B']));
    g.setDependencies('A', new Set());

    expect(g.getDependencies('A')).toEqual(new Set());
    expect(g.getDependents('B').size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getDependents
// ---------------------------------------------------------------------------

describe('DependencyGraph  -  getDependents', () => {
  it('returns direct dependents', () => {
    const g = new DependencyGraph();
    g.setDependencies('B', new Set(['A']));
    g.setDependencies('C', new Set(['A']));

    const dependents = g.getDependents('A');
    expect(dependents).toEqual(new Set(['B', 'C']));
  });

  it('returns empty set for a cell with no dependents', () => {
    const g = new DependencyGraph();
    expect(g.getDependents('X').size).toBe(0);
  });

  it('returns empty set for a cell that has no dependents after removal', () => {
    const g = new DependencyGraph();
    g.setDependencies('B', new Set(['A']));
    g.removeDependencies('B');
    expect(g.getDependents('A').size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getDependencies
// ---------------------------------------------------------------------------

describe('DependencyGraph  -  getDependencies', () => {
  it('returns the dependencies of a cell', () => {
    const g = new DependencyGraph();
    g.setDependencies('C', new Set(['A', 'B']));

    expect(g.getDependencies('C')).toEqual(new Set(['A', 'B']));
  });

  it('returns empty set for a cell with no dependencies', () => {
    const g = new DependencyGraph();
    expect(g.getDependencies('Z').size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// removeDependencies
// ---------------------------------------------------------------------------

describe('DependencyGraph  -  removeDependencies', () => {
  it('removes forward and reverse maps for a cell', () => {
    const g = new DependencyGraph();
    g.setDependencies('A', new Set(['B', 'C']));
    g.removeDependencies('A');

    expect(g.getDependencies('A').size).toBe(0);
    expect(g.getDependents('B').size).toBe(0);
    expect(g.getDependents('C').size).toBe(0);
  });

  it('does not affect other cells when removing one cell', () => {
    const g = new DependencyGraph();
    g.setDependencies('A', new Set(['X']));
    g.setDependencies('B', new Set(['X']));
    g.removeDependencies('A');

    expect(g.getDependents('X')).toEqual(new Set(['B']));
    expect(g.getDependencies('B')).toEqual(new Set(['X']));
  });

  it('is safe to call on a cell that has no dependencies', () => {
    const g = new DependencyGraph();
    expect(() => g.removeDependencies('unknown')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getRecalcOrder
// ---------------------------------------------------------------------------

describe('DependencyGraph  -  getRecalcOrder', () => {
  it('returns an empty array when no cells depend on the changed cell', () => {
    const g = new DependencyGraph();
    expect(g.getRecalcOrder('A')).toEqual([]);
  });

  it('returns direct dependents when a single cell changes', () => {
    const g = new DependencyGraph();
    g.setDependencies('B', new Set(['A']));

    const order = g.getRecalcOrder('A');
    expect(order).toEqual(['B']);
  });

  it('cascades through a chain A -> B -> C', () => {
    const g = new DependencyGraph();
    g.setDependencies('B', new Set(['A']));
    g.setDependencies('C', new Set(['B']));

    const order = g.getRecalcOrder('A');
    expect(order).toContain('B');
    expect(order).toContain('C');
    // B must appear before C (topological order)
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'));
  });

  it('returns topological order: dependencies before dependents', () => {
    const g = new DependencyGraph();
    // A -> B -> D
    //      C -> D
    g.setDependencies('B', new Set(['A']));
    g.setDependencies('C', new Set(['A']));
    g.setDependencies('D', new Set(['B', 'C']));

    const order = g.getRecalcOrder('A');
    expect(order).toContain('B');
    expect(order).toContain('C');
    expect(order).toContain('D');
    // Both B and C must appear before D
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'));
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
  });
});

// ---------------------------------------------------------------------------
// getRecalcOrderBatch
// ---------------------------------------------------------------------------

describe('DependencyGraph  -  getRecalcOrderBatch', () => {
  it('handles multiple changed cells', () => {
    const g = new DependencyGraph();
    g.setDependencies('C', new Set(['A']));
    g.setDependencies('D', new Set(['B']));

    const order = g.getRecalcOrderBatch(['A', 'B']);
    expect(order).toContain('C');
    expect(order).toContain('D');
  });

  it('merges recalc order without duplicates', () => {
    const g = new DependencyGraph();
    // Both A and B are depended on by C
    g.setDependencies('C', new Set(['A', 'B']));

    const order = g.getRecalcOrderBatch(['A', 'B']);
    expect(order).toEqual(['C']);
  });

  it('returns empty array when no cells are affected', () => {
    const g = new DependencyGraph();
    expect(g.getRecalcOrderBatch(['X', 'Y'])).toEqual([]);
  });

  it('preserves topological order in batch mode', () => {
    const g = new DependencyGraph();
    g.setDependencies('B', new Set(['A']));
    g.setDependencies('C', new Set(['B']));
    g.setDependencies('D', new Set(['A']));

    const order = g.getRecalcOrderBatch(['A']);
    // B must come before C
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'));
  });
});

// ---------------------------------------------------------------------------
// wouldCreateCycle
// ---------------------------------------------------------------------------

describe('DependencyGraph  -  wouldCreateCycle', () => {
  it('detects self-reference', () => {
    const g = new DependencyGraph();
    expect(g.wouldCreateCycle('A', new Set(['A']))).toBe(true);
  });

  it('detects a direct cycle A -> B -> A', () => {
    const g = new DependencyGraph();
    g.setDependencies('A', new Set(['B']));
    // Proposing B depends on A would create B -> A -> B cycle
    expect(g.wouldCreateCycle('B', new Set(['A']))).toBe(true);
  });

  it('detects an indirect cycle A -> B -> C -> A', () => {
    const g = new DependencyGraph();
    g.setDependencies('A', new Set(['B']));
    g.setDependencies('B', new Set(['C']));
    // Proposing C depends on A would create C -> A -> B -> C cycle
    expect(g.wouldCreateCycle('C', new Set(['A']))).toBe(true);
  });

  it('does not report false positives for valid dependencies', () => {
    const g = new DependencyGraph();
    g.setDependencies('A', new Set(['B']));
    // C depending on A is perfectly valid  -  no cycle
    expect(g.wouldCreateCycle('C', new Set(['A']))).toBe(false);
  });

  it('does not report false positives for independent chains', () => {
    const g = new DependencyGraph();
    g.setDependencies('A', new Set(['B']));
    g.setDependencies('C', new Set(['D']));
    // A depending on D is fine  -  different chains
    expect(g.wouldCreateCycle('A', new Set(['D']))).toBe(false);
  });

  it('handles checking multiple proposed dependencies', () => {
    const g = new DependencyGraph();
    g.setDependencies('A', new Set(['B']));
    // C depending on both A and X  -  no cycle
    expect(g.wouldCreateCycle('C', new Set(['A', 'X']))).toBe(false);
    // B depending on A  -  A -> B -> A cycle
    expect(g.wouldCreateCycle('B', new Set(['A', 'X']))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------

describe('DependencyGraph  -  clear', () => {
  it('empties all internal state', () => {
    const g = new DependencyGraph();
    g.setDependencies('A', new Set(['B']));
    g.setDependencies('C', new Set(['D']));
    g.clear();

    expect(g.getDependencies('A').size).toBe(0);
    expect(g.getDependencies('C').size).toBe(0);
    expect(g.getDependents('B').size).toBe(0);
    expect(g.getDependents('D').size).toBe(0);
  });

  it('allows adding new dependencies after clearing', () => {
    const g = new DependencyGraph();
    g.setDependencies('A', new Set(['B']));
    g.clear();
    g.setDependencies('X', new Set(['Y']));

    expect(g.getDependencies('X')).toEqual(new Set(['Y']));
    expect(g.getDependents('Y')).toEqual(new Set(['X']));
  });
});

// ---------------------------------------------------------------------------
// Complex graph topologies
// ---------------------------------------------------------------------------

describe('DependencyGraph  -  complex graphs', () => {
  it('handles diamond dependency: A,B -> C; A -> D; D -> C', () => {
    const g = new DependencyGraph();
    // C depends on A and B
    // D depends on A
    // C also depends on D (diamond: A -> D -> C and A -> C)
    g.setDependencies('C', new Set(['A', 'B', 'D']));
    g.setDependencies('D', new Set(['A']));

    const order = g.getRecalcOrder('A');
    expect(order).toContain('C');
    expect(order).toContain('D');
    // D must appear before C (since C depends on D)
    expect(order.indexOf('D')).toBeLessThan(order.indexOf('C'));
  });

  it('handles fan-out: A -> B, C, D', () => {
    const g = new DependencyGraph();
    g.setDependencies('B', new Set(['A']));
    g.setDependencies('C', new Set(['A']));
    g.setDependencies('D', new Set(['A']));

    const order = g.getRecalcOrder('A');
    expect(order).toHaveLength(3);
    expect(new Set(order)).toEqual(new Set(['B', 'C', 'D']));
  });

  it('handles fan-in: B, C, D -> A', () => {
    const g = new DependencyGraph();
    g.setDependencies('A', new Set(['B', 'C', 'D']));

    // Changing B should recalculate A
    expect(g.getRecalcOrder('B')).toEqual(['A']);
    // Changing C should recalculate A
    expect(g.getRecalcOrder('C')).toEqual(['A']);
    // Changing D should recalculate A
    expect(g.getRecalcOrder('D')).toEqual(['A']);
  });

  it('handles deep chain A -> B -> C -> D -> E', () => {
    const g = new DependencyGraph();
    g.setDependencies('B', new Set(['A']));
    g.setDependencies('C', new Set(['B']));
    g.setDependencies('D', new Set(['C']));
    g.setDependencies('E', new Set(['D']));

    const order = g.getRecalcOrder('A');
    expect(order).toEqual(['B', 'C', 'D', 'E']);
  });
});

// ---------------------------------------------------------------------------
// Topological ordering guarantee
// ---------------------------------------------------------------------------

describe('DependencyGraph  -  topological ordering guarantee', () => {
  it('dependents always appear after their dependencies in recalc order', () => {
    const g = new DependencyGraph();
    // Build a more complex graph
    // A -> B, C
    // B -> D
    // C -> D
    // D -> E
    g.setDependencies('B', new Set(['A']));
    g.setDependencies('C', new Set(['A']));
    g.setDependencies('D', new Set(['B', 'C']));
    g.setDependencies('E', new Set(['D']));

    const order = g.getRecalcOrder('A');
    expect(order).toHaveLength(4);

    // Verify every cell appears after all its dependencies that are in the order
    for (let i = 0; i < order.length; i++) {
      const cell = order[i];
      const deps = g.getDependencies(cell);
      for (const dep of deps) {
        const depIndex = order.indexOf(dep);
        if (depIndex !== -1) {
          expect(depIndex).toBeLessThan(i);
        }
      }
    }
  });

  it('handles a wide graph maintaining order', () => {
    const g = new DependencyGraph();
    // Root -> L1a, L1b, L1c
    // L1a, L1b -> L2
    // L1c -> L3
    // L2, L3 -> Final
    g.setDependencies('L1a', new Set(['Root']));
    g.setDependencies('L1b', new Set(['Root']));
    g.setDependencies('L1c', new Set(['Root']));
    g.setDependencies('L2', new Set(['L1a', 'L1b']));
    g.setDependencies('L3', new Set(['L1c']));
    g.setDependencies('Final', new Set(['L2', 'L3']));

    const order = g.getRecalcOrder('Root');
    expect(order).toHaveLength(6);

    // L1a, L1b must appear before L2
    expect(order.indexOf('L1a')).toBeLessThan(order.indexOf('L2'));
    expect(order.indexOf('L1b')).toBeLessThan(order.indexOf('L2'));
    // L1c must appear before L3
    expect(order.indexOf('L1c')).toBeLessThan(order.indexOf('L3'));
    // L2 and L3 must appear before Final
    expect(order.indexOf('L2')).toBeLessThan(order.indexOf('Final'));
    expect(order.indexOf('L3')).toBeLessThan(order.indexOf('Final'));
  });
});
