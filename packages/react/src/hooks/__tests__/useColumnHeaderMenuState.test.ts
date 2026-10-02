import { act, renderHook } from '@testing-library/react';
import { useColumnHeaderMenuState } from '../useColumnHeaderMenuState';

describe('header menu autosize scoping', () => {
  it('measures only its own grid for one-column and all-column actions', () => {
    const wrapper = document.createElement('div');
    const otherGrid = document.createElement('div');
    const id = 'amount"\\total';
    function addCell(container: HTMLElement, width: number) {
      const cell = document.createElement('div');
      cell.setAttribute('data-column-id', id);
      Object.defineProperty(cell, 'offsetWidth', { configurable: true, value: width });
      container.appendChild(cell);
    }
    addCell(wrapper, 100);
    addCell(otherGrid, 800);
    document.body.append(wrapper, otherGrid);
    const onAutosizeColumn = jest.fn();
    const { result } = renderHook(() => useColumnHeaderMenuState({
      wrapperRef: { current: wrapper },
      pinnedColumns: {},
      onPinColumn: jest.fn(),
      onUnpinColumn: jest.fn(),
      sortDirection: 'asc',
      onColumnSort: jest.fn(),
      onAutosizeColumn,
      columns: [{ columnId: id, minWidth: 20 }],
    }));
    act(() => result.current.open(id, wrapper));
    act(() => result.current.handleAutosizeThis());
    const width = onAutosizeColumn.mock.calls[0][1];
    expect(width).toBeGreaterThanOrEqual(100);
    expect(width).toBeLessThan(800);
    onAutosizeColumn.mockClear();
    act(() => result.current.open(id, wrapper));
    act(() => result.current.handleAutosizeAll());
    expect(onAutosizeColumn).toHaveBeenCalledWith(id, width);
    wrapper.remove();
    otherGrid.remove();
  });
});
