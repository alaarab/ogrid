import { type Ref, type ShallowRef } from 'vue';
import type { RowId, IActiveCell, ISelectionRange, IColumnDef, ICellValueChangedEvent, RowSelectionMode } from '../types';
import type { EditingCell } from './useCellEditing';
import type { ContextMenuPosition } from './useContextMenu';
/** Accept either Ref or ShallowRef for state fields */
type MaybeShallowRef<T> = Ref<T> | ShallowRef<T>;
export interface UseKeyboardNavigationParams<T> {
    data: {
        items: Ref<T[]>;
        visibleCols: Ref<IColumnDef<T>[]>;
        colOffset: number;
        hasCheckboxCol: Ref<boolean>;
        visibleColumnCount: Ref<number>;
        getRowId: (item: T) => RowId;
    };
    state: {
        activeCell: MaybeShallowRef<IActiveCell | null>;
        selectionRange: MaybeShallowRef<ISelectionRange | null>;
        editingCell: MaybeShallowRef<EditingCell | null>;
        selectedRowIds: Ref<Set<RowId>>;
    };
    handlers: {
        setActiveCell: (cell: IActiveCell | null) => void;
        setSelectionRange: (range: ISelectionRange | null) => void;
        setEditingCell: (cell: EditingCell | null) => void;
        handleRowCheckboxChange: (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
        handleCopy: () => void;
        handleCut: () => void;
        handlePaste: () => Promise<void>;
        setContextMenu: (pos: ContextMenuPosition | null) => void;
        onUndo?: () => void;
        onRedo?: () => void;
        clearClipboardRanges?: () => void;
    };
    features: {
        editable: Ref<boolean | undefined>;
        onCellValueChanged: Ref<((event: ICellValueChangedEvent<T>) => void) | undefined>;
        rowSelection: Ref<RowSelectionMode>;
        wrapperRef: Ref<HTMLElement | null> | ShallowRef<HTMLElement | null>;
        scrollToRow?: (index: number, align?: 'start' | 'center' | 'end') => void;
    };
}
export interface UseKeyboardNavigationResult {
    handleGridKeyDown: (e: KeyboardEvent) => void;
}
/**
 * Handles all keyboard navigation, shortcuts, and cell editing triggers for the grid.
 */
export declare function useKeyboardNavigation<T>(params: UseKeyboardNavigationParams<T>): UseKeyboardNavigationResult;
export {};
