import { describe, it, expect, mock } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type * as React from 'react';
import { useCellDescriptorCache, useDataGridCellHandlers } from '../useDataGridCellHandlers';
import { useDataGridSheetCoordinates } from '../useDataGridSheetCoordinates';
import type { CellRenderDescriptorInput } from '../../utils';
import type { IColumnDef, IOGridDataGridProps } from '../../types';

type Row = { id: string };
const rows: Row[] = [{ id: 'a' }, { id: 'b' }];
const columns: IColumnDef<Row>[] = [{ columnId: 'name', name: 'Name' }];

type HandlerArgs = Parameters<typeof useDataGridCellHandlers<Row>>;
type HandlerProps = HandlerArgs[0];
type HandlerState = HandlerArgs[1];

function handlerState(over: { updateSelection?: HandlerState['rowSelection']['updateSelection']; selected?: Set<string | number> } = {}): HandlerState {
  const editing = {
    commitCellEdit: () => {}, setEditingCell: mock(() => {}), setPendingEditorValue: () => {}, cancelPopoverEdit: () => {},
    pendingEditorValue: undefined, popoverAnchorEl: null,
  };
  const interaction = { handleCellMouseDown: () => {}, setActiveCell: () => {}, handlePaste: async () => {} };
  const contextMenu = { handleCellContextMenu: () => {}, handleLongPressStart: () => {}, handleLongPressEnd: () => {} };
  return {
    editing: editing as unknown as HandlerState['editing'],
    interaction: interaction as unknown as HandlerState['interaction'],
    contextMenu: contextMenu as unknown as HandlerState['contextMenu'],
    rowSelection: { updateSelection: over.updateSelection ?? (() => {}), selectedRowIds: over.selected ?? new Set() },
  };
}
const handlerProps = (over: Partial<HandlerProps> = {}): HandlerProps => ({
  items: rows, getRowId: (r) => r.id, rowSelection: 'single', ...over,
});

describe('useDataGridCellHandlers (GridRow memo inputs)', () => {
  it('keeps every handler identity when only volatile inputs change', () => {
    const state = handlerState();
    const { result, rerender } = renderHook((a: HandlerArgs) => useDataGridCellHandlers(...a), {
      initialProps: [handlerProps(), state, columns, 0] as HandlerArgs,
    });
    const first = result.current;
    rerender([
      handlerProps({ items: [...rows], getRowId: (r) => r.id }),
      { ...state, rowSelection: { ...state.rowSelection, selectedRowIds: new Set(['a']) } },
      [...columns],
      1,
    ]);
    expect(result.current.delegatedCellHandlers).toBe(first.delegatedCellHandlers);
    expect(result.current.editCallbacks).toBe(first.editCallbacks);
    expect(result.current.interactionHandlers).toBe(first.interactionHandlers);
    expect(result.current.handleSingleRowClick).toBe(first.handleSingleRowClick);
    expect(result.current.handlePasteVoid).toBe(first.handlePasteVoid);
  });

  it('changes a callback group only when one of its members changes', () => {
    const state = handlerState();
    const { result, rerender } = renderHook((a: HandlerArgs) => useDataGridCellHandlers(...a), {
      initialProps: [handlerProps(), state, columns, 0] as HandlerArgs,
    });
    const first = result.current;
    rerender([handlerProps(), { ...state, editing: { ...state.editing, commitCellEdit: () => {} } }, columns, 0]);
    expect(result.current.editCallbacks).not.toBe(first.editCallbacks);
    expect(result.current.interactionHandlers).toBe(first.interactionHandlers);
  });

  it('single-row click toggles the clicked row, resolving the real id', () => {
    const updateSelection = mock((_ids: Set<string | number>) => {});
    const numRows = [{ id: 1 }, { id: 2 }] as unknown as Row[];
    const props = handlerProps({ items: numRows });
    const { result, rerender } = renderHook((a: HandlerArgs) => useDataGridCellHandlers(...a), {
      initialProps: [props, handlerState({ updateSelection }), columns, 0] as HandlerArgs,
    });
    const click = { currentTarget: { dataset: { rowId: '2' } } } as unknown as React.MouseEvent<HTMLTableRowElement>;
    result.current.handleSingleRowClick(click);
    expect([...(updateSelection.mock.calls[0]?.[0] ?? [])]).toEqual([2]);
    rerender([props, handlerState({ updateSelection, selected: new Set([2]) }), columns, 0]);
    result.current.handleSingleRowClick(click);
    expect(updateSelection.mock.calls[1]?.[0]?.size).toBe(0);
  });

  it('ignores row clicks unless rowSelection is single', () => {
    const updateSelection = mock((_ids: Set<string | number>) => {});
    const { result } = renderHook(() => useDataGridCellHandlers(handlerProps({ rowSelection: 'multiple' }), handlerState({ updateSelection }), columns, 0));
    result.current.handleSingleRowClick({ currentTarget: { dataset: { rowId: 'a' } } } as unknown as React.MouseEvent<HTMLTableRowElement>);
    expect(updateSelection).not.toHaveBeenCalled();
  });

  it('double-click edits the cell under the pointer using the latest rows (a windowed source’s loaded rows)', () => {
    const state = handlerState();
    const { result, rerender } = renderHook((a: HandlerArgs) => useDataGridCellHandlers(...a), {
      initialProps: [handlerProps(), state, columns, 0] as HandlerArgs,
    });
    const windowed = { loadedRows: [{ id: 'z' }] } as unknown as IOGridDataGridProps<Row>['windowed'];
    rerender([handlerProps({ windowed }), state, columns, 0]);
    const el = document.createElement('td');
    el.setAttribute('data-row-index', '0');
    el.setAttribute('data-col-index', '0');
    el.setAttribute('data-can-edit', '');
    result.current.delegatedCellHandlers.onDoubleClick({ currentTarget: el } as unknown as React.MouseEvent);
    expect(state.editing.setEditingCell).toHaveBeenCalledWith({ rowId: 'z', columnId: 'name' });
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
  type Args = Parameters<typeof useDataGridSheetCoordinates<Row>>;
  const args = (props: Partial<Args[0]> = {}, activeCell: Args[4] = null): Args => [
    { items: rows, ...props }, columns, undefined, 0, activeCell, 0,
  ];

  it('has no rowNumberOf without a row map, and a stable one with it', () => {
    const map = { toSheetRow: (d: number) => d + 10, toDisplayRow: (s: number) => s - 10 };
    const { result, rerender } = renderHook((a: Args) => useDataGridSheetCoordinates(...a), { initialProps: args() });
    expect(result.current.rowNumberOf).toBeUndefined();
    rerender(args({ formulaRowMap: map }));
    const fn = result.current.rowNumberOf;
    expect(fn?.(0)).toBe(11);
    rerender(args({ formulaRowMap: map }, { rowIndex: 0, columnIndex: 0 }));
    expect(result.current.rowNumberOf).toBe(fn);
  });

  it('reports the active cell reference after render, and null when it clears', () => {
    const onActiveCellChange = mock((_ref: string | null) => {});
    const { rerender } = renderHook((a: Args) => useDataGridSheetCoordinates(...a), {
      initialProps: args({ onActiveCellChange }, { rowIndex: 1, columnIndex: 0 }),
    });
    expect(onActiveCellChange).toHaveBeenLastCalledWith('A2');
    rerender(args({ onActiveCellChange }, null));
    expect(onActiveCellChange).toHaveBeenLastCalledWith(null);
  });
});
