import { renderHook, act } from '@testing-library/react';
import { useColumnResize } from '../useColumnResize';
import type { IColumnDef } from '../../types';

describe('useColumnResize', () => {
  const mockColumn: IColumnDef<{ id: string; name: string }> = {
    columnId: 'name',
    name: 'Name',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns handleResizeStart and getColumnWidth', () => {
    const setColumnSizingOverrides = jest.fn();
    const { result } = renderHook(() =>
      useColumnResize<{ id: string; name: string }>({
        columnSizingOverrides: {},
        setColumnSizingOverrides,
      })
    );
    expect(typeof result.current.handleResizeStart).toBe('function');
    expect(typeof result.current.getColumnWidth).toBe('function');
  });

  it('getColumnWidth returns override width when present', () => {
    const setColumnSizingOverrides = jest.fn();
    const { result } = renderHook(() =>
      useColumnResize<{ id: string; name: string }>({
        columnSizingOverrides: { name: { widthPx: 250 } },
        setColumnSizingOverrides,
      })
    );
    expect(result.current.getColumnWidth(mockColumn)).toBe(250);
  });

  it('getColumnWidth returns idealWidth when no override', () => {
    const setColumnSizingOverrides = jest.fn();
    const col: IColumnDef<{ id: string; name: string }> = {
      ...mockColumn,
      idealWidth: 180,
    };
    const { result } = renderHook(() =>
      useColumnResize<{ id: string; name: string }>({
        columnSizingOverrides: {},
        setColumnSizingOverrides,
      })
    );
    expect(result.current.getColumnWidth(col)).toBe(180);
  });

  it('getColumnWidth returns defaultWidth from column when no override or idealWidth', () => {
    const setColumnSizingOverrides = jest.fn();
    const col: IColumnDef<{ id: string; name: string }> = {
      ...mockColumn,
      defaultWidth: 150,
    };
    const { result } = renderHook(() =>
      useColumnResize<{ id: string; name: string }>({
        columnSizingOverrides: {},
        setColumnSizingOverrides,
      })
    );
    expect(result.current.getColumnWidth(col)).toBe(150);
  });

  it('getColumnWidth returns hook defaultWidth param when no column config', () => {
    const setColumnSizingOverrides = jest.fn();
    const { result } = renderHook(() =>
      useColumnResize<{ id: string; name: string }>({
        columnSizingOverrides: {},
        setColumnSizingOverrides,
        defaultWidth: 200,
      })
    );
    expect(result.current.getColumnWidth(mockColumn)).toBe(200);
  });

  it('getColumnWidth returns 120 when no width config provided', () => {
    const setColumnSizingOverrides = jest.fn();
    const { result } = renderHook(() =>
      useColumnResize<{ id: string; name: string }>({
        columnSizingOverrides: {},
        setColumnSizingOverrides,
      })
    );
    expect(result.current.getColumnWidth(mockColumn)).toBe(120);
  });

  it('mouseup completes resize and calls onColumnResized', () => {
    const setColumnSizingOverrides = jest.fn();
    const onColumnResized = jest.fn();
    const { result } = renderHook(() =>
      useColumnResize<{ id: string; name: string }>({
        columnSizingOverrides: {},
        setColumnSizingOverrides,
        onColumnResized,
      })
    );

    const mockEvent = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      clientX: 100,
      currentTarget: {
        parentElement: {
          getBoundingClientRect: () => ({ width: 150 }),
        },
      },
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart(mockEvent, mockColumn);
    });

    act(() => {
      const moveEvent = new MouseEvent('mousemove', { clientX: 130, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    act(() => {
      const upEvent = new MouseEvent('mouseup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    expect(onColumnResized).toHaveBeenCalledWith('name', 180);
  });

  it('uses override cascade: override > idealWidth > defaultWidth > defaultWidth param', () => {
    const setColumnSizingOverrides = jest.fn();
    const col: IColumnDef<{ id: string; name: string }> = {
      columnId: 'test',
      name: 'Test',
      idealWidth: 180,
      defaultWidth: 150,
    };

    // Test with override
    const { result: r1 } = renderHook(() =>
      useColumnResize<{ id: string; name: string }>({
        columnSizingOverrides: { test: { widthPx: 250 } },
        setColumnSizingOverrides,
        defaultWidth: 100,
      })
    );
    expect(r1.current.getColumnWidth(col)).toBe(250);

    // Test without override (uses idealWidth)
    const { result: r2 } = renderHook(() =>
      useColumnResize<{ id: string; name: string }>({
        columnSizingOverrides: {},
        setColumnSizingOverrides,
        defaultWidth: 100,
      })
    );
    expect(r2.current.getColumnWidth(col)).toBe(180);

    // Test without idealWidth (uses column defaultWidth)
    const col2: IColumnDef<{ id: string; name: string }> = {
      columnId: 'test',
      name: 'Test',
      defaultWidth: 150,
    };
    const { result: r3 } = renderHook(() =>
      useColumnResize<{ id: string; name: string }>({
        columnSizingOverrides: {},
        setColumnSizingOverrides,
        defaultWidth: 100,
      })
    );
    expect(r3.current.getColumnWidth(col2)).toBe(150);

    // Test without column config (uses hook defaultWidth param)
    const col3: IColumnDef<{ id: string; name: string }> = {
      columnId: 'test',
      name: 'Test',
    };
    const { result: r4 } = renderHook(() =>
      useColumnResize<{ id: string; name: string }>({
        columnSizingOverrides: {},
        setColumnSizingOverrides,
        defaultWidth: 100,
      })
    );
    expect(r4.current.getColumnWidth(col3)).toBe(100);
  });
});
