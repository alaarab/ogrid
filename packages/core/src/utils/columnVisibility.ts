import type { IColumnMeta } from '../types/columnTypes';
import type { IColumnVisibilityState } from '../types/dataGridTypes';
import type { IResponsiveColumnsConfig } from './responsiveColumns';
import { getResponsiveHiddenColumns } from './responsiveColumns';

type VisibilityColumn = Pick<IColumnMeta, 'columnId' | 'defaultVisible' | 'required' | 'responsivePriority'>;

export const EMPTY_COLUMN_VISIBILITY: IColumnVisibilityState = Object.freeze({
  hidden: [],
  shown: [],
}) as IColumnVisibilityState;

function isDefaultVisible(column: VisibilityColumn): boolean {
  return column.required === true || column.defaultVisible !== false;
}

export function normalizeColumnVisibility(state: Partial<IColumnVisibilityState> | null | undefined): IColumnVisibilityState {
  const shown = Array.isArray(state?.shown) ? [...new Set(state.shown.map(String))] : [];
  const shownSet = new Set(shown);
  const hidden = Array.isArray(state?.hidden) ? [...new Set(state.hidden.map(String))].filter((id) => !shownSet.has(id)) : [];
  return { hidden, shown };
}

export function resolveColumnVisibility(
  columns: readonly VisibilityColumn[],
  state: Partial<IColumnVisibilityState> | null | undefined,
): Set<string> {
  const { hidden, shown } = normalizeColumnVisibility(state);
  const hiddenSet = new Set(hidden);
  const shownSet = new Set(shown);
  const visible = new Set<string>();
  for (const column of columns) {
    const id = column.columnId;
    if (column.required === true || shownSet.has(id) || (!hiddenSet.has(id) && column.defaultVisible !== false)) visible.add(id);
  }
  if (visible.size > 0 || columns.length === 0) return visible;
  const defaults = columns.filter(isDefaultVisible).map((c) => c.columnId);
  return new Set(defaults.length > 0 ? defaults : columns.map((c) => c.columnId));
}

export function getFitHiddenColumns(
  columns: readonly IColumnMeta[],
  state: Partial<IColumnVisibilityState> | null | undefined,
  containerWidth: number,
  config: IResponsiveColumnsConfig | undefined,
): Set<string> {
  if (!config || containerWidth <= 0) return new Set();
  const shown = new Set(normalizeColumnVisibility(state).shown);
  const hidden = getResponsiveHiddenColumns(containerWidth, columns, config);
  for (const id of shown) hidden.delete(id);
  return hidden;
}

export function updateColumnVisibility(
  columns: readonly VisibilityColumn[],
  state: Partial<IColumnVisibilityState> | null | undefined,
  previousVisible: ReadonlySet<string>,
  nextVisible: ReadonlySet<string>,
): IColumnVisibilityState {
  const current = normalizeColumnVisibility(state);
  const hidden = new Set(current.hidden);
  const shown = new Set(current.shown);
  for (const column of columns) {
    const id = column.columnId;
    const was = previousVisible.has(id);
    const now = nextVisible.has(id);
    if (was === now || column.required === true) continue;
    if (now) {
      hidden.delete(id);
      if (column.defaultVisible === false || column.responsivePriority != null) shown.add(id);
    } else {
      shown.delete(id);
      if (column.defaultVisible !== false) hidden.add(id);
    }
  }
  return { hidden: [...hidden], shown: [...shown] };
}

export function columnVisibilityFromVisibleColumns(
  columns: readonly VisibilityColumn[],
  visibleColumns: Iterable<string>,
  knownColumnIds?: Iterable<string>,
): IColumnVisibilityState {
  const visible = new Set(visibleColumns);
  const known = knownColumnIds ? new Set(knownColumnIds) : null;
  const hidden: string[] = [];
  const shown: string[] = [];
  for (const column of columns) {
    const id = column.columnId;
    if (column.required === true || (known && !known.has(id))) continue;
    const isVisible = visible.has(id);
    if (isVisible && column.defaultVisible === false) shown.push(id);
    else if (!isVisible && column.defaultVisible !== false) hidden.push(id);
  }
  return { hidden, shown };
}

export function sameColumnVisibility(
  a: Partial<IColumnVisibilityState> | null | undefined,
  b: Partial<IColumnVisibilityState> | null | undefined,
): boolean {
  const left = normalizeColumnVisibility(a);
  const right = normalizeColumnVisibility(b);
  const same = (x: string[], y: string[]) => x.length === y.length && x.every((id) => y.includes(id));
  return same(left.hidden, right.hidden) && same(left.shown, right.shown);
}
