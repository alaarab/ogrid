import { describe, it, expect, mock } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type * as React from 'react';
import { useDataGridCellHandlers } from '../useDataGridCellHandlers';
import type { UseDataGridCellHandlersParams } from '../useDataGridCellHandlers';
import { useCellDescriptorCache } from '../useCellDescriptorCache';
import { useDataGridSheetCoordinates } from '../useDataGridSheetCoordinates';
import type { UseDataGridSheetCoordinatesParams } from '../useDataGridSheetCoordinates';
import type { CellRenderDescriptorInput } from '../../utils';
import type { IColumnDef } from '../../types';

type Row = { id: string };
const rows: Row[] = [{ id: 'a' }, { id: 'b' }];
const columns: IColumnDef<Row>[] = [{ columnId: 'name', name: 'Name' }];

function handlerParams(over: Partial<UseDataGridCellHandlersParams<Row>> = {}): UseDataGridCellHandlersParams<Row> {
  const editing = {
    commitCellEdit: () => {}, setEditingCell: mock(() => {}), setPendingEditorValue: () => {}, cancelPopoverEdit: () => {},
    pendingEditorValue: undefined, popoverAnchorEl: null,
  };
  const interaction = { handleCellMouseDown: () => {}, setActiveCell: () => {}, handlePaste: async () => {} };
  const ctxMenu = { handleCellContextMenu: () => {}, handleLongPressStart: () => {}, handleLongPressEnd: () => {} };
  return {
    editing: editing as unknown as UseDataGridCellHandlersParams<Row>['editing'],
    interaction: interaction as unknown as UseDataGridCellHandlersParams<Row>['interaction'],
    ctxMenu: ctxMenu as unknown as UseDataGridCellHandlersParams<Row>['ctxMenu'],
    rows,
    getRowId: (r) => r.id,
    visibleCols: columns,
    colOffset: 0,
    rowSelection: 'single',
    updateSelection: () => {},
    selectedRowIds: new Set(),
    ...over,
  };
}

describe('useDataGridCellHandlers (GridRow memo inputs)', () => {
  it('keeps every handler identity when only volatile inputs change', () => {
    const initial = handlerParams();
    const { result, rerender } = renderHook((p: UseDataGridCellHandlersParams<Row>) => useDataGridCellHandlers(p), { initialProps: initial });
    const first = result.current;
    rerender({
      ...initial,
      rows: [...rows],
      visibleCols: [...columns],
      colOffset: 1,
      selectedRowIds: new Set(['a']),
      getRowId: (r) => r.id,
    });
    expect(result.current.delegatedCellHandlers).toBe(first.delegatedCellHandlers);
    expect(result.current.editCallbacks).toBe(first.editCallbacks);
    expect(result.current.interactionHandlers).toBe(first.interactionHandlers);
    expect(result.current.handleSingleRowClick).toBe(first.handleSingleRowClick);
    expect(result.current.handlePasteVoid).toBe(first.handlePasteVoid);
  });

  it('changes a callback group only when one of its members changes', () => {
    const initial = handlerParams();
    const { result, rerender } = renderHook((p: UseDataGridCellHandlersParams<Row>) => useDataGridCellHandlers(p), { initialProps: initial });
    const first = result.current;
    rerender({ ...initial, editing: { ...initial.editing, commitCellEdit: () => {} } });
    expect(result.current.editCallbacks).not.toBe(first.editCallbacks);
    expect(result.current.interactionHandlers).toBe(first.interactionHandlers);
  });

  it('single-row click toggles the clicked row, resolving the real id', () => {
    const updateSelection = mock((_ids: Set<string | number>) => {});
    const numRows = [{ id: 1 }, { id: 2 }] as unknown as Row[];
    const { result, rerender } = renderHook(
      (p: UseDataGridCellHandlersParams<Row>) => useDataGridCellHandlers(p),
      { initialProps: handlerParams({ rows: numRows, updateSelection, getRowId: (r) => r.id }) },
    );
    const click = { currentTarget: { dataset: { rowId: '2' } } } as unknown as React.MouseEvent<HTMLTableRowElement>;
    result.current.handleSingleRowClick(click);
    expect([...(updateSelection.mock.calls[0]?.[0] ?? [])]).toEqual([2]);
    rerender(handlerParams({ rows: numRows, updateSelection, getRowId: (r) => r.id, selectedRowIds: new Set([2]) }));
    result.current.handleSingleRowClick(click);
    expect(updateSelection.mock.calls[1]?.[0]?.size).toBe(0);
  });

  it('double-click edits the cell under the pointer using the latest rows and columns', () => {
    const params = handlerParams();
    const { result, rerender } = renderHook((p: UseDataGridCellHandlersParams<Row>) => useDataGridCellHandlers(p), { initialProps: params });
    rerender({ ...params, rows: [{ id: 'z' }] });
    const el = document.createElement('td');
    el.setAttribute('data-row-index', '0');
    el.setAttribute('data-col-index', '0');
    el.setAttribute('data-can-edit', '');
    result.current.delegatedCellHandlers.onDoubleClick({ currentTarget: el } as unknown as React.MouseEvent);
    expect(params.editing.setEditingCell).toHaveBeenCalledWith({ rowId: 'z', columnId: 'name' });
  });
});

describe('useCellDescriptorCache', () => {
  const input = { editingCell: null } as unknown as CellRenderDescriptorInput<Row>;

  it('keeps one cache and clears it only when items or visible columns change identity', () => {
    const props = { items: rows, cols: columns };
    const { result, rerender } = renderHook(
      (p: typeof props) => useCellDescriptorCache(input, p.items, p.cols),
      { initialProps: props },
    );
    const cache = result.current.cellDescriptorCacheRef.current;
    const clear = mock(() => {});
    cache.clear = clear;
    rerender({ ...props });
    expect(clear).not.toHaveBeenCalled();
    rerender({ items: [...rows], cols: columns });
    expect(clear).toHaveBeenCalledTimes(1);
    rerender({ items: rows, cols: [...columns] });
    expect(clear).toHaveBeenCalledTimes(2);
    expect(result.current.cellDescriptorCacheRef.current).toBe(cache);
  });
});

describe('useDataGridSheetCoordinates', () => {
  const base: UseDataGridSheetCoordinatesParams<Row> = {
    visibleCols: columns, formulaCol: undefined, formulaRowMap: undefined, rowNumberOffset: 0,
    formulaReferences: undefined, rowCount: 2, activeCell: null, colOffset: 0, onActiveCellChange: undefined,
  };

  it('has no rowNumberOf without a row map, and a stable one with it', () => {
    const map = { toSheetRow: (d: number) => d + 10, toDisplayRow: (s: number) => s - 10 };
    const { result, rerender } = renderHook((p: UseDataGridSheetCoordinatesParams<Row>) => useDataGridSheetCoordinates(p), { initialProps: base });
    expect(result.current.rowNumberOf).toBeUndefined();
    rerender({ ...base, formulaRowMap: map });
    const fn = result.current.rowNumberOf;
    expect(fn?.(0)).toBe(11);
    rerender({ ...base, formulaRowMap: map, activeCell: { rowIndex: 0, columnIndex: 0 } });
    expect(result.current.rowNumberOf).toBe(fn);
  });

  it('reports the active cell reference after render, and null when it clears', () => {
    const onActiveCellChange = mock((_ref: string | null) => {});
    const { rerender } = renderHook((p: UseDataGridSheetCoordinatesParams<Row>) => useDataGridSheetCoordinates(p), {
      initialProps: { ...base, onActiveCellChange, activeCell: { rowIndex: 1, columnIndex: 0 } } as UseDataGridSheetCoordinatesParams<Row>,
    });
    expect(onActiveCellChange).toHaveBeenLastCalledWith('A2');
    rerender({ ...base, onActiveCellChange, activeCell: null });
    expect(onActiveCellChange).toHaveBeenLastCalledWith(null);
  });
});
