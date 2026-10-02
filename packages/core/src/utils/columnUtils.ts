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
 * - Group cells get colSpan = number of adjacent visible leaf descendants.
 * - Leaf cells at a depth shallower than maxDepth are placed at their own depth
 *   (the rendering layer can use rowSpan to stretch them down to the bottom row).
 * - If visibleColumns is provided, only visible leaf columns and their ancestors are included.
 * - If columnOrder is provided, leaves follow that order (ids missing from it keep
 *   their definition order after the ordered ones, matching the body). A group whose
 *   leaves are no longer adjacent is split into one header cell per adjacent run.
 *
 * @param columns - The column tree (mix of IColumnDef and IColumnGroupDef)
 * @param visibleColumns - Optional set of visible column ids (filters out hidden leaves + empty groups)
 * @param columnOrder - Optional display order of leaf column ids
 * @returns Array of HeaderRow, from top (group headers) to bottom (leaf columns)
 */
export function buildHeaderRows<T>(
  columns: (IColumnGroupDef<T> | IColumnDef<T>)[],
  visibleColumns?: Set<string>,
  columnOrder?: readonly string[]
): HeaderRow<T>[] {
  // Step 1: Collect visible leaves with their ancestor groups (definition order)
  const leaves: { col: IColumnDef<T>; ancestors: IColumnGroupDef<T>[] }[] = [];
  function collect(cols: (IColumnGroupDef<T> | IColumnDef<T>)[], ancestors: IColumnGroupDef<T>[]): void {
    for (const c of cols) {
      if (isColumnGroupDef(c)) {
        collect(c.children, [...ancestors, c]);
      } else if (!visibleColumns || visibleColumns.has(c.columnId)) {
        leaves.push({ col: c, ancestors });
      }
    }
  }
  collect(columns, []);

  // Step 2: Put leaves in display order (stable sort; unordered ids go last)
  if (columnOrder?.length) {
    const orderMap = new Map<string, number>();
    columnOrder.forEach((id, i) => {
      orderMap.set(id, i);
    });
    leaves.sort((a, b) => {
      const ia = orderMap.get(a.col.columnId) ?? -1;
      const ib = orderMap.get(b.col.columnId) ?? -1;
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  // Step 3: Build rows for depth 0..maxDepth (groups above, each leaf at its own depth)
  let maxDepth = 0;
  for (const leaf of leaves) maxDepth = Math.max(maxDepth, leaf.ancestors.length);
  const rows: HeaderRow<T>[] = Array.from({ length: maxDepth + 1 }, () => []);

  for (let depth = 0; depth <= maxDepth; depth++) {
    const row = rows[depth];
    if (row === undefined) continue;
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      if (leaf === undefined) continue;
      const group = leaf.ancestors[depth];
      if (group !== undefined) {
        // Extend the previous cell when the leaf to the left shares this group.
        const last = row[row.length - 1];
        if (last !== undefined && leaves[i - 1]?.ancestors[depth] === group) {
          last.colSpan++;
        } else {
          row.push({ label: group.headerName, colSpan: 1, isGroup: true, depth });
        }
      } else if (leaf.ancestors.length === depth) {
        row.push({ label: leaf.col.name, colSpan: 1, isGroup: false, columnDef: leaf.col, depth });
      }
    }
  }

  return rows;
}
