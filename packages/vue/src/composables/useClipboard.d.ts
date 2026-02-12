import { type Ref, type ShallowRef } from 'vue';
import type { ISelectionRange, IActiveCell, ICellValueChangedEvent, IColumnDef } from '../types';
export interface UseClipboardParams<T> {
    items: Ref<T[]>;
    visibleCols: Ref<IColumnDef<T>[]>;
    colOffset: number;
    selectionRange: Ref<ISelectionRange | null> | ShallowRef<ISelectionRange | null>;
    activeCell: Ref<IActiveCell | null> | ShallowRef<IActiveCell | null>;
    editable: Ref<boolean | undefined>;
    onCellValueChanged: Ref<((event: ICellValueChangedEvent<T>) => void) | undefined>;
    beginBatch?: () => void;
    endBatch?: () => void;
}
export interface UseClipboardResult {
    handleCopy: () => void;
    handleCut: () => void;
    handlePaste: () => Promise<void>;
    cutRange: ShallowRef<ISelectionRange | null>;
    copyRange: ShallowRef<ISelectionRange | null>;
    clearClipboardRanges: () => void;
    cutRangeRef: Ref<ISelectionRange | null>;
}
/**
 * Manages copy, cut, and paste operations for cell ranges with TSV clipboard format.
 */
export declare function useClipboard<T>(params: UseClipboardParams<T>): UseClipboardResult;
