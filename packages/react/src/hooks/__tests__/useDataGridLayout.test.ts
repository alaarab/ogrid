import { renderHook, act } from '@testing-library/react';
import type { IColumnDef } from '@alaarab/ogrid-core';
import { useDataGridLayout } from '../useDataGridLayout';

type Row = { id: string };

describe('useDataGridLayout measured widths', () => {
  const OriginalResizeObserver = globalThis.ResizeObserver;
  let resizeCallbacks: (() => void)[] = [];

  beforeEach(() => {
    resizeCallbacks = [];
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(cb: () => void) {
        resizeCallbacks.push(cb);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  });

  afterEach(() => {
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = OriginalResizeObserver;
  });

  it('re-measures auto-width columns after the container narrows', async () => {
    let containerWidth = 1000;
    let thWidth = 500;
    const wrapper = document.createElement('div');
    wrapper.getBoundingClientRect = () => ({ width: containerWidth }) as DOMRect;
    const th = document.createElement('th');
    th.setAttribute('data-column-id', 'a');
    Object.defineProperty(th, 'offsetWidth', { get: () => thWidth });
    wrapper.appendChild(th);
    document.body.appendChild(wrapper);

    const columns: IColumnDef<Row>[] = [{ columnId: 'a', name: 'A' }];
    const items: Row[] = [];
    const getRowId = (r: Row) => r.id;
    const wrapperRef = { current: wrapper };
    const { result } = renderHook(() =>
      useDataGridLayout<Row>({
        columns,
        items,
        getRowId,
        wrapperRef,
      })
    );
    expect(result.current.layout.measuredColumnWidths).toEqual({ a: 500 });

    // The window narrows; the browser lays the column out narrower.
    containerWidth = 400;
    thWidth = 200;
    await act(async () => {
      for (const cb of resizeCallbacks) cb();
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(result.current.layout.containerWidth).toBe(400);
    expect(result.current.layout.measuredColumnWidths).toEqual({ a: 200 });

    wrapper.remove();
  });
});
