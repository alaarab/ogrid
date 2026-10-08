/**
 * Pure helpers for spreadsheet-style structure edits: inserting and deleting
 * rows in a data array, and inserting and deleting leaf columns in a column
 * tree (flat or grouped). Every helper returns new arrays and never mutates
 * its input, so the results can go straight into React state.
 */
import type { RowId, IMergedCell } from '../types/dataGridTypes';
import type { IColumnDef } from '../types/columnTypes';

/** A row removed by `removeRowsById`, with the index it had in the data. */
export interface IRemovedRow<T> {
  index: number;
  row: T;
}

/** Insert `rows` into `data` before `index` (clamped to the data). */
export function insertRowsAt<T>(data: readonly T[], index: number, rows: readonly T[]): T[] {
  const at = clampIndex(index, data.length);
  return [...data.slice(0, at), ...rows, ...data.slice(at)];
}

/**
 * Remove the rows whose id is in `rowIds`. `removed` lists them in ascending
 * index order (indexes into the original `data`), which is what
 * `restoreRemovedRows` needs to put them back.
 */
export function removeRowsById<T>(
  data: readonly T[],
  rowIds: Iterable<RowId>,
  getRowId: (row: T) => RowId,
): { data: T[]; removed: IRemovedRow<T>[] } {
  const ids = new Set(rowIds);
  const next: T[] = [];
  const removed: IRemovedRow<T>[] = [];
  data.forEach((row, index) => {
    if (ids.has(getRowId(row))) removed.push({ index, row });
    else next.push(row);
  });
  return { data: next, removed };
}

/** Put rows removed by `removeRowsById` back at their original indexes. */
export function restoreRemovedRows<T>(data: readonly T[], removed: readonly IRemovedRow<T>[]): T[] {
  const next = data.slice();
  for (const { index, row } of [...removed].sort((a, b) => a.index - b.index)) {
    next.splice(clampIndex(index, next.length), 0, row);
  }
  return next;
}

function isGroup(node: unknown): node is { headerName: string; children: unknown[] } {
  return typeof node === 'object' && node !== null && Array.isArray((node as { children?: unknown }).children);
}

/** Number of leaf columns in a column tree. */
export function countLeafColumns(columns: readonly unknown[]): number {
  let n = 0;
  for (const c of columns) n += isGroup(c) ? countLeafColumns(c.children) : 1;
  return n;
}

/**
 * Insert a leaf column so it becomes the leaf at flat index `index` (the index
 * into `flattenColumns(columns)`). In a grouped tree the column joins the group
 * of the leaf it is inserted before; past the last leaf it joins the last
 * leaf's group.
 */
export function insertColumnAt<N>(columns: readonly N[], index: number, column: N): N[] {
  const total = countLeafColumns(columns);
  const at = clampIndex(index, total);
  if (at === total) return appendAfterLastLeaf(columns, column) ?? [...columns, column];
  let seen = 0;
  const visit = (nodes: readonly N[]): N[] | null => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i] as N;
      if (isGroup(node)) {
        const children = visit(node.children as N[]);
        if (children) return replaceAt(nodes, i, { ...node, children } as N);
      } else {
        if (seen === at) return [...nodes.slice(0, i), column, ...nodes.slice(i)];
        seen++;
      }
    }
    return null;
  };
  return visit(columns) ?? [...columns, column];
}

function appendAfterLastLeaf<N>(nodes: readonly N[], column: N): N[] | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i] as N;
    if (isGroup(node)) {
      const children = appendAfterLastLeaf(node.children as N[], column);
      if (children) return replaceAt(nodes, i, { ...node, children } as N);
    } else {
      return [...nodes.slice(0, i + 1), column, ...nodes.slice(i + 1)];
    }
  }
  return null;
}

/**
 * Remove the leaf column `columnId`. Groups left without children are removed
 * too. Returns null when no such column exists; otherwise the new tree plus the
 * removed column and the flat index it had.
 */
export function removeColumnById<N>(
  columns: readonly N[],
  columnId: string,
): { columns: N[]; column: N; index: number } | null {
  let seen = 0;
  let found: { column: N; index: number } | null = null;
  const visit = (nodes: readonly N[]): N[] => {
    const out: N[] = [];
    for (const node of nodes) {
      if (found === null && isGroup(node)) {
        const children = visit(node.children as N[]);
        if (children.length === node.children.length && found === null) out.push(node);
        else if (children.length > 0) out.push({ ...node, children } as N);
        continue;
      }
      if (!isGroup(node) && found === null && (node as { columnId?: string }).columnId === columnId) {
        found = { column: node, index: seen };
        continue;
      }
      if (!isGroup(node)) seen++;
      out.push(node);
    }
    return out;
  };
  const next = visit(columns);
  if (found === null) return null;
  const { column, index } = found;
  return { columns: next, column, index };
}

/**
 * A blank, editable column for "Insert column": id `column1`, `column2`, ...
 * (the first id not in `existingIds`), named after its number.
 */
export function createStructureColumn<T = unknown>(existingIds: Iterable<string>): IColumnDef<T> {
  const taken = new Set(existingIds);
  let n = 1;
  while (taken.has(`column${n}`)) n++;
  return { columnId: `column${n}`, name: `Column ${n}`, editable: true };
}

/**
 * Carry merged cells through a structure edit. `before` and `after` are the
 * row ids (axis 'row') or leaf column ids (axis 'col') in order before and
 * after the change, e.g. `prevData.map(getRowId)` and `event.data.map(getRowId)`
 * in `onRowsChange`. Like a spreadsheet:
 *
 * - Rows/columns inserted inside a merge grow it; inserted at its edges, they don't.
 * - Deleting part of a merge shrinks it; deleting its anchor moves the anchor
 *   to the first surviving row/column of the block.
 * - A merge left a single cell on both axes, or with nothing left, is dropped.
 *
 * Spans are counted over these orders, so they match the grid's displayed
 * rows when the view shows rows in data order (no sort or filter moving them).
 */
export function remapMergedCells(
  merges: readonly IMergedCell[],
  axis: 'row' | 'col',
  before: readonly (RowId | string)[],
  after: readonly (RowId | string)[],
): IMergedCell[] {
  const beforeIndex = new Map<RowId | string, number>();
  before.forEach((id, i) => {
    beforeIndex.set(id, i);
  });
  const afterIndex = new Map<RowId | string, number>();
  after.forEach((id, i) => {
    afterIndex.set(id, i);
  });
  const out: IMergedCell[] = [];
  for (const merge of merges) {
    const anchor = axis === 'row' ? merge.rowId : merge.columnId;
    const span = Math.max(1, (axis === 'row' ? merge.rowSpan : merge.colSpan) ?? 1);
    const start = beforeIndex.get(anchor);
    if (start === undefined) {
      out.push(merge); // not in this order (e.g. a hidden row): leave it to the grid
      continue;
    }
    // Surviving ids of the block, in their new positions.
    const survivors: number[] = [];
    for (let i = start; i < start + span && i < before.length; i++) {
      const id = before[i];
      const at = id !== undefined ? afterIndex.get(id) : undefined;
      if (at !== undefined) survivors.push(at);
    }
    if (survivors.length === 0) continue;
    const first = Math.min(...survivors);
    const last = Math.max(...survivors);
    const newAnchor = after[first];
    if (newAnchor === undefined) continue;
    const newSpan = last - first + 1;
    const next: IMergedCell = axis === 'row'
      ? { ...merge, rowId: newAnchor as RowId, rowSpan: newSpan }
      : { ...merge, columnId: String(newAnchor), colSpan: newSpan };
    if ((next.rowSpan ?? 1) <= 1 && (next.colSpan ?? 1) <= 1) continue;
    out.push(next);
  }
  return out;
}

function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return length;
  return Math.max(0, Math.min(length, Math.trunc(index)));
}

function replaceAt<N>(nodes: readonly N[], i: number, node: N): N[] {
  const next = nodes.slice();
  next[i] = node;
  return next;
}
