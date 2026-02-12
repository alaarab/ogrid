/**
 * View model helpers for Vue DataGridTable.
 * These are Vue equivalents of the React-specific utils in @alaarab/ogrid-react.
 */
import type { ColumnFilterType, IDateFilterValue, ICellEditorProps } from '../types/columnTypes';
import type { IColumnDef } from '../types/columnTypes';
import type { RowId, UserLike, IFilters, FilterValue, ICellValueChangedEvent } from '../types';
export interface HeaderFilterConfigInput {
    sortBy?: string;
    sortDirection: 'asc' | 'desc';
    onColumnSort: (columnKey: string) => void;
    filters: IFilters;
    onFilterChange: (key: string, value: FilterValue | undefined) => void;
    filterOptions: Record<string, string[]>;
    loadingFilterOptions: Record<string, boolean>;
    peopleSearch?: (query: string) => Promise<UserLike[]>;
}
export interface HeaderFilterConfig {
    columnKey: string;
    columnName: string;
    filterType: ColumnFilterType;
    isSorted?: boolean;
    isSortedDescending?: boolean;
    onSort?: () => void;
    selectedValues?: string[];
    onFilterChange?: (values: string[]) => void;
    options?: string[];
    isLoadingOptions?: boolean;
    textValue?: string;
    onTextChange?: (value: string) => void;
    selectedUser?: UserLike;
    onUserChange?: (user: UserLike | undefined) => void;
    peopleSearch?: (query: string) => Promise<UserLike[]>;
    dateValue?: IDateFilterValue;
    onDateChange?: (value: IDateFilterValue | undefined) => void;
}
export declare function getHeaderFilterConfig<T>(col: IColumnDef<T>, input: HeaderFilterConfigInput): HeaderFilterConfig;
export type CellRenderMode = 'editing-inline' | 'editing-popover' | 'display';
export interface CellRenderDescriptorInput<T> {
    editingCell: {
        rowId: RowId;
        columnId: string;
    } | null;
    activeCell: {
        rowIndex: number;
        columnIndex: number;
    } | null;
    selectionRange: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    } | null;
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
    colOffset: number;
    itemsLength: number;
    getRowId: (item: T) => RowId;
    editable?: boolean;
    onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;
    isDragging?: boolean;
}
export interface CellRenderDescriptor {
    mode: CellRenderMode;
    editorType?: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';
    value?: unknown;
    isActive: boolean;
    isInRange: boolean;
    isInCutRange: boolean;
    isInCopyRange: boolean;
    isSelectionEndCell: boolean;
    canEditAny: boolean;
    isPinned: boolean;
    pinnedSide?: 'left' | 'right';
    globalColIndex: number;
    rowId: RowId;
    rowIndex: number;
    displayValue?: unknown;
}
export declare function getCellRenderDescriptor<T>(item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number, input: CellRenderDescriptorInput<T>): CellRenderDescriptor;
export declare function resolveCellDisplayContent<T>(col: IColumnDef<T>, item: T, displayValue: unknown): unknown;
export declare function resolveCellStyle<T>(col: IColumnDef<T>, item: T): Record<string, string> | undefined;
export declare function buildInlineEditorProps<T>(item: T, col: IColumnDef<T>, descriptor: CellRenderDescriptor, callbacks: {
    commitCellEdit: (item: T, columnId: string, oldValue: unknown, newValue: unknown, rowIndex: number, globalColIndex: number) => void;
    setEditingCell: (cell: null) => void;
}): {
    value: unknown;
    item: T;
    column: IColumnDef<T>;
    rowIndex: number;
    editorType: "text" | "select" | "checkbox" | "richSelect" | "date";
    onCommit: (newValue: unknown) => void;
    onCancel: () => void;
};
export declare function buildPopoverEditorProps<T>(item: T, col: IColumnDef<T>, descriptor: CellRenderDescriptor, pendingEditorValue: unknown, callbacks: {
    setPendingEditorValue: (value: unknown) => void;
    commitCellEdit: (item: T, columnId: string, oldValue: unknown, newValue: unknown, rowIndex: number, globalColIndex: number) => void;
    cancelPopoverEdit: () => void;
}): ICellEditorProps<T>;
export interface CellInteractionHandlers {
    handleCellMouseDown: (e: MouseEvent, rowIndex: number, colIndex: number) => void;
    setActiveCell: (cell: {
        rowIndex: number;
        columnIndex: number;
    }) => void;
    setEditingCell: (cell: {
        rowId: RowId;
        columnId: string;
    } | null) => void;
    handleCellContextMenu: (e: {
        clientX: number;
        clientY: number;
        preventDefault?: () => void;
    }) => void;
}
export interface CellInteractionProps {
    'data-row-index': number;
    'data-col-index': number;
    'data-in-range'?: 'true';
    tabindex: number;
    role?: 'button';
    onMousedown: (e: MouseEvent) => void;
    onClick: () => void;
    onContextmenu: (e: MouseEvent) => void;
    onDblclick?: () => void;
}
export declare function getCellInteractionProps(descriptor: CellRenderDescriptor, columnId: string, handlers: CellInteractionHandlers): CellInteractionProps;
