import { renderHook, act } from '@testing-library/react';
import { useContextMenu } from '../useContextMenu';

describe('useContextMenu', () => {
  it('returns contextMenu null and handlers', () => {
    const { result } = renderHook(() => useContextMenu());
    expect(result.current.contextMenu).toBeNull();
    expect(typeof result.current.setContextMenu).toBe('function');
    expect(typeof result.current.handleCellContextMenu).toBe('function');
    expect(typeof result.current.closeContextMenu).toBe('function');
  });

  it('handleCellContextMenu sets context menu position', () => {
    const { result } = renderHook(() => useContextMenu());
    act(() => {
      result.current.handleCellContextMenu({ clientX: 100, clientY: 200 });
    });
    expect(result.current.contextMenu).toEqual({ x: 100, y: 200 });
  });

  it('closeContextMenu clears context menu', () => {
    const { result } = renderHook(() => useContextMenu());
    act(() => {
      result.current.handleCellContextMenu({ clientX: 50, clientY: 50 });
    });
    act(() => {
      result.current.closeContextMenu();
    });
    expect(result.current.contextMenu).toBeNull();
  });

  it('setContextMenu sets position directly', () => {
    const { result } = renderHook(() => useContextMenu());
    act(() => {
      result.current.setContextMenu({ x: 10, y: 20 });
    });
    expect(result.current.contextMenu).toEqual({ x: 10, y: 20 });
  });
});
