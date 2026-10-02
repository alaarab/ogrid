import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import { useOGrid } from '../useOGrid';
import { useDataGridTableOrchestration } from '../useDataGridTableOrchestration';
import type { IOGridApi } from '../../types';

type Row = { id: string };
const columns = [{ columnId: 'id', name: 'ID' }];
const getRowId = (row: Row) => row.id;
const data = [{ id: '0' }, { id: '1' }, { id: '2' }];

describe('scrollToRow API integration', () => {
  // Other test files replace the global ResizeObserver with jest mocks that can
  // be reset; install a stable stub so this suite doesn't depend on file order.
  const OriginalResizeObserver = globalThis.ResizeObserver;
  beforeEach(() => {
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });
  afterEach(() => {
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = OriginalResizeObserver;
  });

  it('connects API and active-cell scrolling to a scaled windowed table', () => {
    const apiRef = React.createRef<IOGridApi<Row>>();
    const windowed = {
      rowCount: 10_000_000,
      getRow: () => ({ status: 'loading' as const }),
      requestWindow: jest.fn(), retryRow: jest.fn(),
    };
    const { result, rerender } = renderHook(() => {
      const grid = useOGrid({ columns, getRowId, data }, apiRef);
      return useDataGridTableOrchestration({ props: { ...grid.dataGridProps, items: [], windowed } });
    });
    const container = document.createElement('div');
    container.innerHTML = '<table><thead></thead></table>';
    Object.defineProperty(container, 'clientHeight', { value: 720 });
    container.querySelector('thead')!.getBoundingClientRect = () => ({ height: 48 }) as DOMRect;
    container.scrollTo = jest.fn((options: ScrollToOptions) => { container.scrollTop = options.top ?? 0; });
    result.current.wrapperRef.current = container;
    rerender();
    act(() => apiRef.current!.scrollToRow(5_000_000, { align: 'center' }));
    expect(result.current.visibleRange.startIndex).toBeLessThanOrEqual(5_000_000);
    expect(result.current.visibleRange.endIndex).toBeGreaterThanOrEqual(5_000_000);
    act(() => result.current.setActiveCell({ rowIndex: 9_999_999, columnIndex: 0 }));
    expect(result.current.visibleRange.endIndex).toBe(9_999_999);
    expect(container.scrollTop).toBeCloseTo(32_000_000 - 672, 5);
  });
  for (const align of ['start', 'center', 'end'] as const) {
    it(`scrolls real DOM rows with ${align} alignment below the sticky header`, () => {
      const apiRef = React.createRef<IOGridApi<Row>>();
      const { result, rerender, unmount } = renderHook(() => {
        const grid = useOGrid({ columns, getRowId, data }, apiRef);
        const table = useDataGridTableOrchestration({ props: grid.dataGridProps });
        return { grid, table };
      });
      const container = document.createElement('div');
      container.innerHTML = '<table><thead></thead><tbody><tr data-row-id="2"><td data-row-index="2"></td></tr></tbody></table>';
      Object.defineProperty(container, 'clientHeight', { value: 300 });
      container.getBoundingClientRect = () => ({ top: 10 }) as DOMRect;
      container.querySelector('thead')!.getBoundingClientRect = () => ({ height: 48 }) as DOMRect;
      container.querySelector('tbody tr')!.getBoundingClientRect = () => ({ top: 510, height: 40 }) as DOMRect;
      container.scrollTo = jest.fn();
      result.current.table.wrapperRef.current = container;
      rerender();
      act(() => apiRef.current!.scrollToRow(2, { align }));
      const adjustment = align === 'center' ? (252 - 40) / 2 : align === 'end' ? 252 - 40 : 0;
      expect(container.scrollTo).toHaveBeenCalledWith({ top: 452 - adjustment, behavior: 'auto' });
      const scrollRef = result.current.grid.dataGridProps.scrollToRowRef;
      unmount();
      expect(scrollRef?.current).toBeNull();
    });
  }

  it('uses a single row height for virtual math when both height props are provided', () => {
    const apiRef = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(() => {
      const grid = useOGrid({
        columns, getRowId, data, rowHeight: 60, virtualScroll: { enabled: true, rowHeight: 48 },
      }, apiRef);
      return useDataGridTableOrchestration({ props: grid.dataGridProps });
    });
    expect(result.current.virtualRowHeight).toBe(60);
  });
});
