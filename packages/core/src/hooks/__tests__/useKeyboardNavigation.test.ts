import { renderHook, act } from '@testing-library/react';
import { useKeyboardNavigation } from '../useKeyboardNavigation';

describe('useKeyboardNavigation', () => {
  const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }];
  const visibleCols = [
    { columnId: 'name', name: 'Name' },
  ] as import('../../types').IColumnDef<{ id: string; name: string }>[];
  const wrapperRef = { current: document.createElement('div') };

  const defaultParams = {
    items,
    visibleCols,
    colOffset: 0,
    hasCheckboxCol: false,
    visibleColumnCount: 1,
    activeCell: null,
    setActiveCell: jest.fn(),
    selectionRange: null,
    setSelectionRange: jest.fn(),
    editable: false,
    onCellValueChanged: undefined,
    getRowId: (item: { id: string }) => item.id,
    editingCell: null,
    setEditingCell: jest.fn(),
    rowSelection: 'none' as const,
    selectedRowIds: new Set<string>(),
    handleRowCheckboxChange: jest.fn(),
    handleCopy: jest.fn(),
    handleCut: jest.fn(),
    handlePaste: jest.fn().mockResolvedValue(undefined),
    setContextMenu: jest.fn(),
    wrapperRef,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns handleGridKeyDown function', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ ...defaultParams })
    );

    expect(typeof result.current.handleGridKeyDown).toBe('function');
  });

  it('ArrowDown when activeCell is null sets active cell to (0, colOffset) and prevents default', () => {
    const setActiveCell = jest.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        ...defaultParams,
        setActiveCell,
      })
    );

    const e = {
      key: 'ArrowDown',
      preventDefault: jest.fn(),
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleGridKeyDown(e);
    });

    expect(setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('when items.length is 0, ArrowDown does nothing', () => {
    const setActiveCell = jest.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        ...defaultParams,
        items: [],
        setActiveCell,
      })
    );

    const e = {
      key: 'ArrowDown',
      preventDefault: jest.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleGridKeyDown(e);
    });

    expect(setActiveCell).not.toHaveBeenCalled();
  });

  it('Ctrl+C when activeCell is set calls handleCopy and prevents default', () => {
    const handleCopy = jest.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        ...defaultParams,
        activeCell: { rowIndex: 0, columnIndex: 0 },
        handleCopy,
      })
    );

    const e = {
      key: 'c',
      preventDefault: jest.fn(),
      ctrlKey: true,
      metaKey: false,
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleGridKeyDown(e);
    });

    expect(handleCopy).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('Escape when editingCell is set calls setEditingCell(null)', () => {
    const setEditingCell = jest.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        ...defaultParams,
        activeCell: { rowIndex: 0, columnIndex: 0 },
        editingCell: { rowId: '1', columnId: 'name' },
        setEditingCell,
      })
    );

    const e = {
      key: 'Escape',
      preventDefault: jest.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleGridKeyDown(e);
    });

    expect(setEditingCell).toHaveBeenCalledWith(null);
    expect(e.preventDefault).toHaveBeenCalled();
  });
});
