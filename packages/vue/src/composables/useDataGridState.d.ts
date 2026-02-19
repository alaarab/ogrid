import { type Ref, type ShallowRef } from 'vue';
import type { RowId, IOGridDataGridProps, IStatusBarProps, IColumnDef } from '../types';
import type { HeaderFilterConfigInput, CellRenderDescriptorInput } from '../utils';
export interface UseDataGridStateParams<T> {
    props: Ref<IOGridDataGridProps<T>>;
    wrapperRef: Ref<HTMLDivElement | null> | ShallowRef<HTMLDivElement | null>;
}
export interface DataGridLayoutState<T> {
    flatColumns: IColumnDef<T>[];
    visibleCols: IColumnDef<T>[];
    visibleColumnCount: number;
    totalColCount: number;
    colOffset: number;
    hasCheckboxCol: boolean;
    hasRowNumbersCol: boolean;
    rowIndexByRowId: Map<RowId, number>;
    containerWidth: number;
    minTableWidth: number;
    desiredTableWidth: number;
    columnSizingOverrides: Record<string, {
        widthPx: number;
    }>;
    setColumnSizingOverrides: (value: Record<string, {
        widthPx: number;
    }>) => void;
    onColumnResized?: (columnId: string, width: number) => void;
    /** Called when user requests autosize for a single column (with measured width). */
    onAutosizeColumn?: (columnId: string, width: number) => void;
    /** DOM-measured column widths from the previous layout pass.
     *  UI packages use these as a minWidth floor to prevent columns from
     *  shrinking when new data loads (e.g. during server-side pagination). */
    measuredColumnWidths: Record<string, number>;
}
export interface DataGridRowSelectionState {
    selectedRowIds: Set<RowId>;
    updateSelection: (newSelectedIds: Set<RowId>) => void;
    handleRowCheckboxChange: (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
    handleSelectAll: (checked: boolean) => void;
    allSelected: boolean;
    someSelected: boolean;
}
export interface DataGridEditingState<T> {
    editingCell: {
        rowId: RowId;
        columnId: string;
    } | null;
    setEditingCell: (cell: {
        rowId: RowId;
        columnId: string;
    } | null) => void;
    pendingEditorValue: unknown;
    setPendingEditorValue: (value: unknown) => void;
    commitCellEdit: (item: T, columnId: string, oldValue: unknown, newValue: unknown, rowIndex: number, globalColIndex: number) => void;
    cancelPopoverEdit: () => void;
    popoverAnchorEl: HTMLElement | null;
    setPopoverAnchorEl: (el: HTMLElement | null) => void;
}
export interface DataGridCellInteractionState {
    activeCell: {
        rowIndex: number;
        columnIndex: number;
    } | null;
    setActiveCell: (cell: {
        rowIndex: number;
        columnIndex: number;
    } | null) => void;
    selectionRange: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    } | null;
    setSelectionRange: (range: DataGridCellInteractionState['selectionRange']) => void;
    handleCellMouseDown: (e: MouseEvent, rowIndex: number, globalColIndex: number) => void;
    handleSelectAllCells: () => void;
    hasCellSelection: boolean;
    handleGridKeyDown: (e: KeyboardEvent) => void;
    handleFillHandleMouseDown: (e: MouseEvent) => void;
    handleCopy: () => void;
    handleCut: () => void;
    handlePaste: () => Promise<void>;
    cutRange: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    } | null;
    copyRange: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    } | null;
    clearClipboardRanges: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onUndo?: () => void;
    onRedo?: () => void;
    isDragging: boolean;
}
export interface DataGridContextMenuState {
    menuPosition: {
        x: number;
        y: number;
    } | null;
    setMenuPosition: (pos: {
        x: number;
        y: number;
    } | null) => void;
    handleCellContextMenu: (e: {
        clientX: number;
        clientY: number;
        preventDefault?: () => void;
    }) => void;
    closeContextMenu: () => void;
}
export interface DataGridViewModelState<T> {
    headerFilterInput: HeaderFilterConfigInput;
    cellDescriptorInput: CellRenderDescriptorInput<T>;
    statusBarConfig: IStatusBarProps | null;
    showEmptyInGrid: boolean;
    onCellError?: (error: Error, info: unknown) => void;
}
export interface DataGridPinningState {
    pinnedColumns: Record<string, 'left' | 'right'>;
    pinColumn: (columnId: string, side: 'left' | 'right') => void;
    unpinColumn: (columnId: string) => void;
    isPinned: (columnId: string) => 'left' | 'right' | undefined;
    leftOffsets: Record<string, number>;
    rightOffsets: Record<string, number>;
    headerMenu: {
        isOpen: boolean;
        openForColumn: string | null;
        anchorElement: HTMLElement | null;
        open: (columnId: string, anchorEl: HTMLElement) => void;
        close: () => void;
        handlePinLeft: () => void;
        handlePinRight: () => void;
        handleUnpin: () => void;
        handleSortAsc: () => void;
        handleSortDesc: () => void;
        handleClearSort: () => void;
        handleAutosizeThis: () => void;
        handleAutosizeAll: () => void;
        canPinLeft: boolean;
        canPinRight: boolean;
        canUnpin: boolean;
        currentSort: 'asc' | 'desc' | null;
        isSortable: boolean;
        isResizable: boolean;
    };
}
export interface UseDataGridStateResult<T> {
    layout: Ref<DataGridLayoutState<T>>;
    rowSelection: Ref<DataGridRowSelectionState>;
    editing: Ref<DataGridEditingState<T>>;
    interaction: Ref<DataGridCellInteractionState>;
    contextMenu: Ref<DataGridContextMenuState>;
    viewModels: Ref<DataGridViewModelState<T>>;
    pinning: Ref<DataGridPinningState>;
}
/**
 * Single orchestration composable for DataGridTable. Takes grid props and wrapper ref,
 * returns all derived state and handlers so UI packages can be thin view layers.
 */
export declare function useDataGridState<T>(params: UseDataGridStateParams<T>): UseDataGridStateResult<T>;
