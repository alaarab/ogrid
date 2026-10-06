import { describe, it, expect, mock } from 'bun:test';
import { applySheetState, sheetStateDefaults } from '../useOGridSheetState';
import type { SheetStateControlled, SheetStateSetters } from '../useOGridSheetState';

const uncontrolled: SheetStateControlled = {
  visibleColumns: false, sort: false, filters: false, page: false, selectedRows: false, columnOrder: false,
};

function setters() {
  return {
    setVisibleColumns: mock(() => {}),
    setSort: mock(() => {}),
    setFilters: mock(() => {}),
    setPage: mock(() => {}),
    setSelectedRows: mock(() => {}),
    setColumnOrder: mock(() => {}),
    setColumnWidths: mock(() => {}),
    setPinned: mock(() => {}),
  } satisfies SheetStateSetters;
}

describe('sheetStateDefaults', () => {
  it('starts a new sheet from its own defaults', () => {
    const d = sheetStateDefaults({ field: 'name', direction: 'desc' });
    expect(d.sort).toEqual({ field: 'name', direction: 'desc' });
    expect(d.page).toBe(1);
    expect(d.filters).toEqual({});
    expect(d.selectedRows.size).toBe(0);
    expect(d.columnWidths).toEqual({});
    // Left to their own hooks to reconcile against the new column defs.
    expect(d.visibleColumns).toBeUndefined();
    expect(d.columnOrder).toBeUndefined();
    expect(d.pinned).toBeUndefined();
  });
});

describe('applySheetState', () => {
  const captured = {
    visibleColumns: new Set(['a']),
    sort: { field: 'a', direction: 'asc' as const },
    filters: { a: { type: 'text' as const, value: 'x' } },
    page: 3,
    selectedRows: new Set(['1']),
    columnOrder: ['a', 'b'],
    columnWidths: { a: 120 },
    pinned: { a: 'left' as const },
  };

  it('restores every slot of an uncontrolled grid', () => {
    const set = setters();
    applySheetState(captured, uncontrolled, set);
    expect(set.setVisibleColumns).toHaveBeenCalledWith(captured.visibleColumns);
    expect(set.setSort).toHaveBeenCalledWith(captured.sort);
    expect(set.setFilters).toHaveBeenCalledWith(captured.filters);
    expect(set.setPage).toHaveBeenCalledWith(3);
    expect(set.setSelectedRows).toHaveBeenCalledWith(captured.selectedRows);
    expect(set.setColumnOrder).toHaveBeenCalledWith(captured.columnOrder);
    expect(set.setColumnWidths).toHaveBeenCalledWith(captured.columnWidths);
    expect(set.setPinned).toHaveBeenCalledWith(captured.pinned);
  });

  it('never writes a slot the host controls', () => {
    const set = setters();
    applySheetState(captured, {
      visibleColumns: true, sort: true, filters: true, page: true, selectedRows: true, columnOrder: true,
    }, set);
    expect(set.setVisibleColumns).not.toHaveBeenCalled();
    expect(set.setSort).not.toHaveBeenCalled();
    expect(set.setFilters).not.toHaveBeenCalled();
    expect(set.setPage).not.toHaveBeenCalled();
    expect(set.setSelectedRows).not.toHaveBeenCalled();
    expect(set.setColumnOrder).not.toHaveBeenCalled();
    // Widths and pins have no controlled prop.
    expect(set.setColumnWidths).toHaveBeenCalled();
    expect(set.setPinned).toHaveBeenCalled();
  });

  it('leaves visibility and pins to their own reconcile on a first-time sheet', () => {
    const set = setters();
    applySheetState(sheetStateDefaults({ field: '', direction: 'asc' }), uncontrolled, set);
    expect(set.setVisibleColumns).not.toHaveBeenCalled();
    expect(set.setPinned).not.toHaveBeenCalled();
    // A first-time sheet's column order resets to the column defs.
    expect(set.setColumnOrder).toHaveBeenCalledWith(undefined);
  });
});
