import { renderHook, act } from '@testing-library/react';
import { useColumnChooserState } from '../useColumnChooserState';
import type { IColumnDefinition } from '../../types/columnTypes';

describe('useColumnChooserState', () => {
  const mockColumns: IColumnDefinition[] = [
    { columnId: 'a', name: 'A' },
    { columnId: 'b', name: 'B' },
    { columnId: 'c', name: 'C', required: true },
  ];

  it('returns initial state with open=false', () => {
    const onVisibilityChange = jest.fn();
    const { result } = renderHook(() =>
      useColumnChooserState({
        columns: mockColumns,
        visibleColumns: new Set(['a', 'b', 'c']),
        onVisibilityChange,
      })
    );
    expect(result.current.open).toBe(false);
    expect(result.current.visibleCount).toBe(3);
    expect(result.current.totalCount).toBe(3);
  });

  it('handleToggle toggles open state', () => {
    const onVisibilityChange = jest.fn();
    const { result } = renderHook(() =>
      useColumnChooserState({
        columns: mockColumns,
        visibleColumns: new Set(['a', 'b', 'c']),
        onVisibilityChange,
      })
    );
    expect(result.current.open).toBe(false);
    act(() => {
      result.current.handleToggle();
    });
    expect(result.current.open).toBe(true);
    act(() => {
      result.current.handleToggle();
    });
    expect(result.current.open).toBe(false);
  });

  it('handleClose closes the dropdown', () => {
    const onVisibilityChange = jest.fn();
    const { result } = renderHook(() =>
      useColumnChooserState({
        columns: mockColumns,
        visibleColumns: new Set(['a', 'b', 'c']),
        onVisibilityChange,
      })
    );
    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.open).toBe(true);
    act(() => {
      result.current.handleClose();
    });
    expect(result.current.open).toBe(false);
  });

  it('Escape key closes the dropdown when open', () => {
    const onVisibilityChange = jest.fn();
    const { result } = renderHook(() =>
      useColumnChooserState({
        columns: mockColumns,
        visibleColumns: new Set(['a', 'b', 'c']),
        onVisibilityChange,
      })
    );
    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.open).toBe(true);
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.dispatchEvent(event);
    });
    expect(result.current.open).toBe(false);
  });

  it('handleCheckboxChange calls onVisibilityChange', () => {
    const onVisibilityChange = jest.fn();
    const { result } = renderHook(() =>
      useColumnChooserState({
        columns: mockColumns,
        visibleColumns: new Set(['a', 'b', 'c']),
        onVisibilityChange,
      })
    );
    act(() => {
      result.current.handleCheckboxChange('a')(false);
    });
    expect(onVisibilityChange).toHaveBeenCalledWith('a', false);
    act(() => {
      result.current.handleCheckboxChange('b')(true);
    });
    expect(onVisibilityChange).toHaveBeenCalledWith('b', true);
  });

  it('handleSelectAll makes all hidden columns visible', () => {
    const onVisibilityChange = jest.fn();
    const { result } = renderHook(() =>
      useColumnChooserState({
        columns: mockColumns,
        visibleColumns: new Set(['a']),
        onVisibilityChange,
      })
    );
    act(() => {
      result.current.handleSelectAll();
    });
    expect(onVisibilityChange).toHaveBeenCalledWith('b', true);
    expect(onVisibilityChange).toHaveBeenCalledWith('c', true);
    expect(onVisibilityChange).not.toHaveBeenCalledWith('a', true);
  });

  it('handleClearAll hides all visible columns except required', () => {
    const onVisibilityChange = jest.fn();
    const { result } = renderHook(() =>
      useColumnChooserState({
        columns: mockColumns,
        visibleColumns: new Set(['a', 'b', 'c']),
        onVisibilityChange,
      })
    );
    act(() => {
      result.current.handleClearAll();
    });
    expect(onVisibilityChange).toHaveBeenCalledWith('a', false);
    expect(onVisibilityChange).toHaveBeenCalledWith('b', false);
    expect(onVisibilityChange).not.toHaveBeenCalledWith('c', false);
  });

  it('visibleCount reflects current visible columns', () => {
    const onVisibilityChange = jest.fn();
    const { result, rerender } = renderHook(
      ({ visibleColumns }) =>
        useColumnChooserState({
          columns: mockColumns,
          visibleColumns,
          onVisibilityChange,
        }),
      { initialProps: { visibleColumns: new Set(['a']) } }
    );
    expect(result.current.visibleCount).toBe(1);
    rerender({ visibleColumns: new Set(['a', 'b', 'c']) });
    expect(result.current.visibleCount).toBe(3);
  });

  it('totalCount reflects total columns', () => {
    const onVisibilityChange = jest.fn();
    const { result } = renderHook(() =>
      useColumnChooserState({
        columns: mockColumns,
        visibleColumns: new Set(['a', 'b']),
        onVisibilityChange,
      })
    );
    expect(result.current.totalCount).toBe(3);
  });
});
