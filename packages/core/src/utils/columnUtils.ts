import type { IColumnDef, IColumnGroupDef, HeaderRow } from '../types/columnTypes';

function isColumnGroupDef<T>(
  c: IColumnGroupDef<T> | IColumnDef<T>
): c is IColumnGroupDef<T> {
  return 'children' in c && Array.isArray((c as IColumnGroupDef<T>).children);
}

/**
 * Flattens a tree of column groups and column definitions into a single array of leaf columns.
 * Used for body rendering and when the grid accepts grouped columns.
 */
export function flattenColumns<T>(
  columns: (IColumnGroupDef<T> | IColumnDef<T>)[]
): IColumnDef<T>[] {
  const result: IColumnDef<T>[] = [];
  for (const c of columns) {
    if (isColumnGroupDef(c)) {
      result.push(...flattenColumns(c.children));
    } else {
      result.push(c);
    }
  }
  return result;
}

/**
 * Builds an array of header rows from a column tree for multi-row <thead> rendering.
 *
 * - Flat columns (no groups) produce a single row of leaf cells.
 * - Grouped columns produce N rows where N = max nesting depth + 1.
 * - Group cells get colSpan = number of visible leaf descendants.
 * - Leaf cells at a depth shallower than maxDepth are placed at their own depth
 *   (the rendering layer can use rowSpan to stretch them down to the bottom row).
 * - If visibleColumns is provided, only visible leaf columns and their ancestors are included.
 *
 * @param columns - The column tree (mix of IColumnDef and IColumnGroupDef)
 * @param visibleColumns - Optional set of visible column ids (filters out hidden leaves + empty groups)
 * @returns Array of HeaderRow, from top (group headers) to bottom (leaf columns)
 */
export function buildHeaderRows<T>(
  columns: (IColumnGroupDef<T> | IColumnDef<T>)[],
  visibleColumns?: Set<string>
): HeaderRow<T>[] {
  // Step 1: Compute max depth of the column tree
  function getMaxDepth(cols: (IColumnGroupDef<T> | IColumnDef<T>)[], depth: number): number {
    let max = depth;
    for (const c of cols) {
      if (isColumnGroupDef(c)) {
        max = Math.max(max, getMaxDepth(c.children, depth + 1));
      }
    }
    return max;
  }

  const maxDepth = getMaxDepth(columns, 0);

  // If no groups at all, return a single row of leaf cells
  if (maxDepth === 0) {
    const row: HeaderRow<T> = [];
    for (const c of columns) {
      if (!isColumnGroupDef(c)) {
        if (visibleColumns && !visibleColumns.has(c.columnId)) continue;
        row.push({
          label: c.name,
          colSpan: 1,
          isGroup: false,
          columnDef: c,
          depth: 0,
        });
      }
    }
    return [row];
  }

  // Step 2: Build rows for depth 0..maxDepth
  // Total rows = maxDepth + 1 (groups use rows 0..maxDepth-1, leaves use row maxDepth)
  const totalRows = maxDepth + 1;
  const rows: HeaderRow<T>[] = Array.from({ length: totalRows }, () => []);

  // Step 3: Walk the tree and place cells
  // Cache leaf counts by children array ref to avoid O(n²) repeated traversals
  const leafCountCache = new Map<(IColumnGroupDef<T> | IColumnDef<T>)[], number>();
  function countVisibleLeaves(cols: (IColumnGroupDef<T> | IColumnDef<T>)[]): number {
    const cached = leafCountCache.get(cols);
    if (cached !== undefined) return cached;
    let count = 0;
    for (const c of cols) {
      if (isColumnGroupDef(c)) {
        count += countVisibleLeaves(c.children);
      } else {
        if (!visibleColumns || visibleColumns.has(c.columnId)) {
          count++;
        }
      }
    }
    leafCountCache.set(cols, count);
    return count;
  }

  function walk(
    cols: (IColumnGroupDef<T> | IColumnDef<T>)[],
    depth: number
  ): void {
    for (const c of cols) {
      if (isColumnGroupDef(c)) {
        const leafCount = countVisibleLeaves(c.children);
        if (leafCount === 0) continue; // Skip empty groups
        const groupRow = rows[depth];
        if (groupRow === undefined) continue;
        groupRow.push({
          label: c.headerName,
          colSpan: leafCount,
          isGroup: true,
          depth,
        });
        walk(c.children, depth + 1);
      } else {
        if (visibleColumns && !visibleColumns.has(c.columnId)) continue;
        // Leaf column: place it at the current depth.
        // If depth < maxDepth, the rendering layer should use rowSpan to stretch
        // this cell down to the bottom row.
        const leafRow = rows[depth];
        if (leafRow === undefined) continue;
        leafRow.push({
          label: c.name,
          colSpan: 1,
          isGroup: false,
          columnDef: c,
          depth,
        });
      }
    }
  }

  walk(columns, 0);

  // Remove any completely empty rows (can happen with certain structures)
  return rows.filter(row => row.length > 0);
}
