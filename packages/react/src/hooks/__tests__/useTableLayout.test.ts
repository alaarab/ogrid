import * as React from 'react';
import { renderHook, act } from '@testing-library/react';
import type { IColumnDef } from '@alaarab/ogrid-core';
import { useTableLayout } from '../useTableLayout';

type Row = { id: string };

const columns: IColumnDef<Row>[] = [
  { columnId: 'a', name: 'A' },
  { columnId: 'b', name: 'B' },
  { columnId: 'c', name: 'C' },
];

function renderLayout(initialColumnWidths?: Record<string, number>) {
  const wrapperRef = React.createRef<HTMLDivElement>();
  return renderHook(
    ({ widths }) =>
      useTableLayout<Row>({
        wrapperRef,
        visibleCols: columns,
        flatColumns: columns,
        hasCheckboxCol: false,
        initialColumnWidths: widths,
      }),
    { initialProps: { widths: initialColumnWidths } }
  );
}

describe('useTableLayout column widths', () => {
  it('seeds sizing overrides from initialColumnWidths', () => {
    const { result } = renderLayout({ a: 120 });
    expect(result.current.columnSizingOverrides).toEqual({ a: { widthPx: 120 } });
  });

  it('applies widths that change after mount (applyColumnState / sheet restore)', () => {
    const { result, rerender } = renderLayout({});
    rerender({ widths: { b: 240 } });
    expect(result.current.columnSizingOverrides).toEqual({ b: { widthPx: 240 } });
    // Restoring an empty state clears the overrides again.
    rerender({ widths: {} });
    expect(result.current.columnSizingOverrides).toEqual({});
  });

  it('ignores an echo of a width the grid already holds, keeping drag-start locks', () => {
    const { result, rerender } = renderLayout({});
    // A drag locks every column and sets the dragged one, then reports it.
    act(() => {
      result.current.setColumnSizingOverrides({ a: { widthPx: 100 }, b: { widthPx: 180 }, c: { widthPx: 100 } });
    });
    rerender({ widths: { b: 180 } });
    expect(result.current.columnSizingOverrides).toEqual({
      a: { widthPx: 100 },
      b: { widthPx: 180 },
      c: { widthPx: 100 },
    });
  });

  it('does not reset on a new object with the same widths', () => {
    const { result, rerender } = renderLayout({ a: 120 });
    act(() => {
      result.current.setColumnSizingOverrides((prev) => ({ ...prev, b: { widthPx: 90 } }));
    });
    rerender({ widths: { a: 120 } });
    expect(result.current.columnSizingOverrides).toEqual({ a: { widthPx: 120 }, b: { widthPx: 90 } });
  });
});
