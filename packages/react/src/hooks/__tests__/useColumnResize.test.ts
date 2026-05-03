import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import * as actualCore from '@alaarab/ogrid-core';
import type { IColumnDef } from '../../types';

const mockedMeasure = mock(() => 200);
mock.module('@alaarab/ogrid-core', () => ({
  ...actualCore,
  measureColumnContentWidth: mockedMeasure,
}));

// Import after mock so the hook picks up the mocked binding.
const { useColumnResize } = await import('../useColumnResize');
const { measureColumnContentWidth } = await import('@alaarab/ogrid-core');
void measureColumnContentWidth;

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

    const mockWrapper = { focus: jest.fn() };
    const mockTh = {
      getBoundingClientRect: () => ({ width: 150 }),
      closest: (sel: string) => {
        if (sel === 'thead') return null;
        if (sel === '[tabindex]') return mockWrapper;
        return mockTh;
      },
      dataset: { columnId: 'name' },
    };
    const mockEvent = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      clientX: 100,
      currentTarget: {
        closest: (sel: string) => sel === 'th' ? mockTh : null,
      },
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart(mockEvent, mockColumn);
    });

    act(() => {
      const moveEvent = new PointerEvent('pointermove', { clientX: 130, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
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

  describe('handleResizeDoubleClick', () => {
    const mockContainer = document.createElement('div');
    const mockTable = document.createElement('table');
    mockContainer.appendChild(mockTable);
    const mockTh = document.createElement('th');
    mockTable.appendChild(mockTh);

    function createDoubleClickEvent(): React.MouseEvent {
      return {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        currentTarget: {
          closest: (sel: string) => (sel === 'th' ? mockTh : null),
        },
      } as unknown as React.MouseEvent;
    }

    beforeEach(() => {
      mockedMeasure.mockClear();
      mockedMeasure.mockReturnValue(200);
    });

    it('handleResizeDoubleClick calls measureColumnContentWidth and updates overrides', () => {
      const setColumnSizingOverrides = jest.fn();
      const { result } = renderHook(() =>
        useColumnResize<{ id: string; name: string }>({
          columnSizingOverrides: {},
          setColumnSizingOverrides,
        })
      );

      const mockEvent = createDoubleClickEvent();

      act(() => {
        result.current.handleResizeDoubleClick(mockEvent, mockColumn);
      });

      expect(mockedMeasure).toHaveBeenCalledWith('name', 80, mockContainer);

      // setColumnSizingOverrides is called with a function updater
      expect(setColumnSizingOverrides).toHaveBeenCalledTimes(1);
      const updater = setColumnSizingOverrides.mock.calls[0][0];
      const newState = updater({ existingCol: { widthPx: 100 } });
      expect(newState).toEqual({
        existingCol: { widthPx: 100 },
        name: { widthPx: 200 },
      });
    });

    it('handleResizeDoubleClick calls onColumnResized callback', () => {
      const setColumnSizingOverrides = jest.fn();
      const onColumnResized = jest.fn();
      mockedMeasure.mockReturnValue(175);

      const { result } = renderHook(() =>
        useColumnResize<{ id: string; name: string }>({
          columnSizingOverrides: {},
          setColumnSizingOverrides,
          onColumnResized,
        })
      );

      const mockEvent = createDoubleClickEvent();

      act(() => {
        result.current.handleResizeDoubleClick(mockEvent, mockColumn);
      });

      expect(onColumnResized).toHaveBeenCalledWith('name', 175);
    });

    it('handleResizeDoubleClick prevents default and stops propagation', () => {
      const setColumnSizingOverrides = jest.fn();
      const { result } = renderHook(() =>
        useColumnResize<{ id: string; name: string }>({
          columnSizingOverrides: {},
          setColumnSizingOverrides,
        })
      );

      const mockEvent = createDoubleClickEvent();

      act(() => {
        result.current.handleResizeDoubleClick(mockEvent, mockColumn);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });
});
