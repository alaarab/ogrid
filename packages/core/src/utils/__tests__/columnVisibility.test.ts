import {
  columnVisibilityFromVisibleColumns,
  getFitHiddenColumns,
  normalizeColumnVisibility,
  resolveColumnVisibility,
  sameColumnVisibility,
  updateColumnVisibility,
} from '../columnVisibility';
import type { IColumnMeta } from '../../types/columnTypes';

const col = (columnId: string, extra: Partial<IColumnMeta> = {}): IColumnMeta => ({ columnId, name: columnId, ...extra });

const v1 = [col('name', { required: true }), col('status'), col('owner'), col('notes', { defaultVisible: false })];
const ids = (set: Set<string>) => [...set].sort();

describe('resolveColumnVisibility', () => {
  it('shows default-visible and required columns when there are no overrides', () => {
    expect(ids(resolveColumnVisibility(v1, undefined))).toEqual(['name', 'owner', 'status']);
  });

  it('applies hidden and shown overrides on top of the defaults', () => {
    expect(ids(resolveColumnVisibility(v1, { hidden: ['status'], shown: ['notes'] }))).toEqual(['name', 'notes', 'owner']);
  });

  it('shows a column added after the choices were saved when its default is visible', () => {
    const saved = { hidden: ['status'], shown: ['notes'] };
    const v2 = [...v1, col('signOff'), col('archive', { defaultVisible: false })];
    expect(ids(resolveColumnVisibility(v2, saved))).toEqual(['name', 'notes', 'owner', 'signOff']);
  });

  it('keeps choices for columns that are not loaded yet and applies them when they arrive', () => {
    const saved = { hidden: ['owner'], shown: [] };
    expect(ids(resolveColumnVisibility([col('status')], saved))).toEqual(['status']);
    expect(ids(resolveColumnVisibility(v1, saved))).toEqual(['name', 'status']);
  });

  it('never hides a required column and never resolves to zero columns', () => {
    expect(ids(resolveColumnVisibility(v1, { hidden: ['name', 'status', 'owner'], shown: [] }))).toEqual(['name']);
    const optional = [col('a'), col('b', { defaultVisible: false })];
    expect(ids(resolveColumnVisibility(optional, { hidden: ['a'], shown: [] }))).toEqual(['a']);
  });
});

describe('updateColumnVisibility', () => {
  it('records only the columns the user changed, as a diff from the defaults', () => {
    const before = resolveColumnVisibility(v1, undefined);
    const after = new Set(['name', 'owner', 'notes']);
    expect(updateColumnVisibility(v1, undefined, before, after)).toEqual({ hidden: ['status'], shown: ['notes'] });
  });

  it('drops an override when the user puts a column back to its default', () => {
    const state = { hidden: ['status'], shown: ['notes'] };
    const before = resolveColumnVisibility(v1, state);
    const after = new Set([...before, 'status']);
    after.delete('notes');
    expect(updateColumnVisibility(v1, state, before, after)).toEqual({ hidden: [], shown: [] });
  });

  it('records showing a hide-to-fit column so it stays on screen at narrow widths', () => {
    const cols = [col('a'), col('wide', { responsivePriority: 2 })];
    const displayed = new Set(['a']);
    expect(updateColumnVisibility(cols, undefined, displayed, new Set(['a', 'wide']))).toEqual({ hidden: [], shown: ['wide'] });
  });

  it('ignores required columns and unknown ids', () => {
    const before = resolveColumnVisibility(v1, undefined);
    expect(updateColumnVisibility(v1, undefined, before, new Set(['owner', 'status', 'ghost']))).toEqual({ hidden: [], shown: [] });
  });
});

describe('getFitHiddenColumns', () => {
  const cols = [col('a'), col('b', { responsivePriority: 1 }), col('c', { responsivePriority: 2 })];
  const config = { breakpoints: [{ minWidth: 0, maxPriority: 0 }, { minWidth: 800, maxPriority: 1 }, { minWidth: 1200, maxPriority: Infinity }] };

  it('hides columns above the priority allowed at the width, lowest priority first', () => {
    expect(ids(getFitHiddenColumns(cols, undefined, 900, config))).toEqual(['c']);
    expect(ids(getFitHiddenColumns(cols, undefined, 500, config))).toEqual(['b', 'c']);
    expect(ids(getFitHiddenColumns(cols, undefined, 1300, config))).toEqual([]);
  });

  it('never hides a column the user chose to show, and does nothing without a config or width', () => {
    expect(ids(getFitHiddenColumns(cols, { hidden: [], shown: ['c'] }, 500, config))).toEqual(['b']);
    expect(getFitHiddenColumns(cols, undefined, 500, undefined).size).toBe(0);
    expect(getFitHiddenColumns(cols, undefined, 0, config).size).toBe(0);
  });
});

describe('columnVisibilityFromVisibleColumns', () => {
  it('turns a saved full visible set into overrides', () => {
    expect(columnVisibilityFromVisibleColumns(v1, ['name', 'owner', 'notes'])).toEqual({ hidden: ['status'], shown: ['notes'] });
  });

  it('leaves columns the old save never knew about on their defaults', () => {
    const v2 = [...v1, col('signOff')];
    expect(columnVisibilityFromVisibleColumns(v2, ['name', 'status'], ['name', 'status', 'owner', 'notes'])).toEqual({ hidden: ['owner'], shown: [] });
  });
});

describe('normalizeColumnVisibility', () => {
  it('accepts partial or malformed stored values', () => {
    expect(normalizeColumnVisibility(null)).toEqual({ hidden: [], shown: [] });
    expect(normalizeColumnVisibility({ hidden: ['a', 'a', 'b'], shown: ['b'] })).toEqual({ hidden: ['a'], shown: ['b'] });
    expect(normalizeColumnVisibility({ hidden: 'a' as unknown as string[] })).toEqual({ hidden: [], shown: [] });
  });

  it('compares states regardless of order', () => {
    expect(sameColumnVisibility({ hidden: ['a', 'b'], shown: [] }, { hidden: ['b', 'a'], shown: [] })).toBe(true);
    expect(sameColumnVisibility({ hidden: ['a'], shown: [] }, { hidden: [], shown: ['a'] })).toBe(false);
  });
});
