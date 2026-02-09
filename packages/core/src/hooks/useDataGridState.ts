import { useMemo, useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { flattenColumns, getDataGridStatusBarConfig } from '../utils';
import type { HeaderFilterConfigInput, CellRenderDescriptorInput } from '../utils';
import type { RowId, IOGridDataGridProps, IStatusBarProps, IColumnDef } from '../types';
import type { ICellValueChangedEvent } from '../types';
import { useRowSelection } from './useRowSelection';
import { useCellEditing } from './useCellEditing';
import { useActiveCell } from './useActiveCell';
import { useCellSelection } from './useCellSelection';
import { useContextMenu } from './useContextMenu';
import { useClipboard } from './useClipboard';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import { useFillHandle } from './useFillHandle';

export interface UseDataGridStateParams<T> {
  props: IOGridDataGridProps<T>;
  wrapperRef: RefObject<HTMLDivElement | null>;
}

export interface UseDataGridStateResult<T> {
  // Columns & layout
  flatColumns: IColumnDef<T>[];
  visibleCols: IColumnDef<T>[];
  visibleColumnCount: number;
  totalColCount: number;
  colOffset: number;
  hasCheckboxCol: boolean;
  rowIndexByRowId: Map<RowId, number>;

  // Row selection
  selectedRowIds: Set<RowId>;
  updateSelection: (newSelectedIds: Set<RowId>) => void;
  handleRowCheckboxChange: (
    rowId: RowId,
    checked: boolean,
    rowIndex: number,
    shiftKey: boolean
  ) => void;
  handleSelectAll: (checked: boolean) => void;
  allSelected: boolean;
  someSelected: boolean;

  // Cell editing
  editingCell: { rowId: RowId; columnId: string } | null;
  setEditingCell: (cell: { rowId: RowId; columnId: string } | null) => void;
  pendingEditorValue: unknown;
  setPendingEditorValue: (value: unknown) => void;

  // Active cell & range selection
  activeCell: { rowIndex: number; columnIndex: number } | null;
  setActiveCell: (cell: { rowIndex: number; columnIndex: number } | null) => void;
  selectionRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null;
  setSelectionRange: (range: UseDataGridStateResult<T>['selectionRange']) => void;
  handleCellMouseDown: (
    e: React.MouseEvent,
    rowIndex: number,
    globalColIndex: number
  ) => void;
  handleSelectAllCells: () => void;

  // Context menu
  contextMenu: { x: number; y: number } | null;
  setContextMenu: (pos: { x: number; y: number } | null) => void;
  handleCellContextMenu: (e: { clientX: number; clientY: number }) => void;
  closeContextMenu: () => void;

  // Clipboard
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => Promise<void>;
  cutRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null;

  // Keyboard
  handleGridKeyDown: (e: React.KeyboardEvent) => void;

  // Fill handle
  handleFillHandleMouseDown: (e: React.MouseEvent) => void;

  // Container & sizing
  containerWidth: number;
  minTableWidth: number;
  columnSizingOverrides: Record<string, { widthPx: number }>;
  setColumnSizingOverrides: React.Dispatch<
    React.SetStateAction<Record<string, { widthPx: number }>>
  >;

  // View-model inputs (eliminates duplicate memos in each UI package)
  headerFilterInput: HeaderFilterConfigInput;
  cellDescriptorInput: CellRenderDescriptorInput<T>;

  // Cell edit helpers (eliminates duplicate commit/cancel handlers)
  commitCellEdit: (
    item: T,
    columnId: string,
    oldValue: unknown,
    newValue: unknown,
    rowIndex: number,
    globalColIndex: number
  ) => void;
  cancelPopoverEdit: () => void;
  popoverAnchorEl: HTMLElement | null;
  setPopoverAnchorEl: React.Dispatch<React.SetStateAction<HTMLElement | null>>;

  // Status bar & empty
  statusBarConfig: IStatusBarProps | null;
  showEmptyInGrid: boolean;
  hasCellSelection: boolean;
}

/**
 * Single orchestration hook for DataGridTable. Takes grid props and wrapper ref,
 * returns all derived state and handlers so Fluent/Material/Radix can be thin view layers.
 */
export function useDataGridState<T>(
  params: UseDataGridStateParams<T>
): UseDataGridStateResult<T> {
  const { props, wrapperRef } = params;
  const {
    items,
    columns,
    getRowId,
    visibleColumns,
    columnOrder,
    rowSelection = 'none',
    selectedRows: controlledSelectedRows,
    onSelectionChange,
    statusBar,
    emptyState,
    editable,
    onCellValueChanged,
    onUndo,
    onRedo,
  } = props;

  const flatColumns = useMemo(() => flattenColumns(columns), [columns]);

  const visibleCols = useMemo(() => {
    const filtered = visibleColumns
      ? flatColumns.filter((c) => visibleColumns.has(c.columnId))
      : flatColumns;
    if (!columnOrder?.length) return filtered;
    return [...filtered].sort((a, b) => {
      const ia = columnOrder.indexOf(a.columnId);
      const ib = columnOrder.indexOf(b.columnId);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [flatColumns, visibleColumns, columnOrder]);

  const visibleColumnCount = visibleCols.length;
  const hasCheckboxCol = rowSelection === 'multiple';
  const totalColCount = visibleColumnCount + (hasCheckboxCol ? 1 : 0);
  const colOffset = hasCheckboxCol ? 1 : 0;

  const rowIndexByRowId = useMemo(() => {
    const m = new Map<RowId, number>();
    items.forEach((item, idx) => m.set(getRowId(item), idx));
    return m;
  }, [items, getRowId]);

  const rowSelectionResult = useRowSelection({
    items,
    getRowId,
    rowSelection,
    controlledSelectedRows,
    onSelectionChange,
  });

  const {
    selectedRowIds,
    updateSelection,
    handleRowCheckboxChange,
    handleSelectAll,
    allSelected,
    someSelected,
  } = rowSelectionResult;

  const {
    editingCell,
    setEditingCell,
    pendingEditorValue,
    setPendingEditorValue,
  } = useCellEditing();

  const { activeCell, setActiveCell } = useActiveCell(wrapperRef, editingCell);

  const {
    selectionRange,
    setSelectionRange,
    handleCellMouseDown: handleCellMouseDownBase,
    handleSelectAllCells,
  } = useCellSelection({
    colOffset,
    rowCount: items.length,
    visibleColCount: visibleCols.length,
    setActiveCell,
  });

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent, rowIndex: number, globalColIndex: number) => {
      (wrapperRef as RefObject<HTMLDivElement | null>).current?.focus();
      handleCellMouseDownBase(e, rowIndex, globalColIndex);
    },
    [handleCellMouseDownBase, wrapperRef]
  );

  const { contextMenu, setContextMenu, handleCellContextMenu, closeContextMenu } =
    useContextMenu();

  const { handleCopy, handleCut, handlePaste, cutRange } = useClipboard({
    items,
    visibleCols,
    colOffset,
    selectionRange,
    activeCell,
    onCellValueChanged,
  });

  const { handleGridKeyDown } = useKeyboardNavigation({
    items,
    visibleCols,
    colOffset,
    hasCheckboxCol,
    visibleColumnCount,
    activeCell,
    setActiveCell,
    selectionRange,
    setSelectionRange,
    editable,
    onCellValueChanged,
    getRowId,
    editingCell,
    setEditingCell,
    rowSelection,
    selectedRowIds,
    handleRowCheckboxChange,
    handleCopy,
    handleCut,
    handlePaste,
    setContextMenu,
    wrapperRef,
    onUndo,
    onRedo,
  });

  const { handleFillHandleMouseDown } = useFillHandle({
    items,
    visibleCols,
    onCellValueChanged,
    selectionRange,
    setSelectionRange,
    setActiveCell,
    colOffset,
    wrapperRef,
  });

  const [containerWidth, setContainerWidth] = useState<number>(0);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      const borderX =
        (parseFloat(cs.borderLeftWidth || '0') || 0) +
        (parseFloat(cs.borderRightWidth || '0') || 0);
      setContainerWidth(Math.max(0, rect.width - borderX));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [wrapperRef]);

  const minTableWidth = useMemo(() => {
    const PADDING = 16;
    const checkboxW = hasCheckboxCol ? 48 : 0;
    return visibleCols.reduce(
      (sum, c) => sum + (c.minWidth ?? 80) + PADDING,
      checkboxW
    );
  }, [visibleCols, hasCheckboxCol]);

  const [columnSizingOverrides, setColumnSizingOverrides] = useState<
    Record<string, { widthPx: number }>
  >({});

  useEffect(() => {
    const colIds = new Set(flatColumns.map((c) => c.columnId));
    setColumnSizingOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of Object.keys(next)) {
        if (!colIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [flatColumns]);

  const statusBarConfig = useMemo(
    () =>
      getDataGridStatusBarConfig(
        statusBar as boolean | IStatusBarProps | undefined,
        items.length,
        selectedRowIds.size
      ),
    [statusBar, items.length, selectedRowIds.size]
  );

  const showEmptyInGrid = items.length === 0 && !!emptyState;
  const hasCellSelection = selectionRange != null || activeCell != null;

  // --- View-model inputs (shared across all 3 DataGridTables) ---

  const {
    sortBy,
    sortDirection,
    onColumnSort,
    textFilters = {},
    onTextFilterChange,
    peopleFilters = {},
    onPeopleFilterChange,
    peopleSearch,
    filterOptions,
    loadingFilterOptions,
    multiSelectFilters,
    onMultiSelectFilterChange,
  } = props;

  const headerFilterInput: HeaderFilterConfigInput = useMemo(
    () => ({
      sortBy,
      sortDirection,
      onColumnSort,
      textFilters,
      onTextFilterChange,
      peopleFilters,
      onPeopleFilterChange,
      peopleSearch,
      filterOptions,
      loadingFilterOptions,
      multiSelectFilters,
      onMultiSelectFilterChange,
    }),
    [
      sortBy,
      sortDirection,
      onColumnSort,
      textFilters,
      onTextFilterChange,
      peopleFilters,
      onPeopleFilterChange,
      peopleSearch,
      filterOptions,
      loadingFilterOptions,
      multiSelectFilters,
      onMultiSelectFilterChange,
    ]
  );

  const cellDescriptorInput: CellRenderDescriptorInput<T> = useMemo(
    () => ({
      editingCell,
      activeCell,
      selectionRange,
      cutRange,
      colOffset,
      itemsLength: items.length,
      getRowId,
      editable,
      onCellValueChanged,
    }),
    [
      editingCell,
      activeCell,
      selectionRange,
      cutRange,
      colOffset,
      items.length,
      getRowId,
      editable,
      onCellValueChanged,
    ]
  );

  // --- Cell edit helpers ---

  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(null);

  const commitCellEdit = useCallback(
    (
      item: T,
      columnId: string,
      oldValue: unknown,
      newValue: unknown,
      rowIndex: number,
      globalColIndex: number
    ) => {
      onCellValueChanged?.({
        item,
        columnId,
        field: columnId,
        oldValue,
        newValue,
        rowIndex,
      } as ICellValueChangedEvent<T>);
      setEditingCell(null);
      setPopoverAnchorEl(null);
      setPendingEditorValue(undefined);
      // Advance to next row for inline editors
      if (rowIndex < items.length - 1) {
        setActiveCell({ rowIndex: rowIndex + 1, columnIndex: globalColIndex });
      }
    },
    [onCellValueChanged, setEditingCell, setPendingEditorValue, setActiveCell, items.length]
  );

  const cancelPopoverEdit = useCallback(() => {
    setEditingCell(null);
    setPopoverAnchorEl(null);
    setPendingEditorValue(undefined);
  }, [setEditingCell, setPendingEditorValue]);

  return {
    flatColumns,
    visibleCols,
    visibleColumnCount,
    totalColCount,
    colOffset,
    hasCheckboxCol,
    rowIndexByRowId,
    selectedRowIds,
    updateSelection,
    handleRowCheckboxChange,
    handleSelectAll,
    allSelected,
    someSelected,
    editingCell,
    setEditingCell,
    pendingEditorValue,
    setPendingEditorValue,
    activeCell,
    setActiveCell,
    selectionRange,
    setSelectionRange,
    handleCellMouseDown,
    handleSelectAllCells,
    contextMenu,
    setContextMenu,
    handleCellContextMenu,
    closeContextMenu,
    handleCopy,
    handleCut,
    handlePaste,
    cutRange,
    handleGridKeyDown,
    handleFillHandleMouseDown,
    containerWidth,
    minTableWidth,
    columnSizingOverrides,
    setColumnSizingOverrides,
    headerFilterInput,
    cellDescriptorInput,
    commitCellEdit,
    cancelPopoverEdit,
    popoverAnchorEl,
    setPopoverAnchorEl,
    statusBarConfig,
    showEmptyInGrid,
    hasCellSelection,
  };
}
