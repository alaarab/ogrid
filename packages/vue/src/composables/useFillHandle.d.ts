import { type Ref, type ShallowRef } from 'vue';
import type { ISelectionRange, IActiveCell, IColumnDef, ICellValueChangedEvent } from '../types';
import type { IVisibleRange } from '@alaarab/ogrid-core';
export interface UseFillHandleParams<T> {
    items: Ref<T[]>;
    visibleCols: Ref<IColumnDef<T>[]>;
    editable: Ref<boolean | undefined>;
    onCellValueChanged: Ref<((event: ICellValueChangedEvent<T>) => void) | undefined>;
    selectionRange: Ref<ISelectionRange | null> | ShallowRef<ISelectionRange | null>;
    setSelectionRange: (range: ISelectionRange | null) => void;
    setActiveCell: (cell: IActiveCell | null) => void;
    colOffset: number;
    wrapperRef: Ref<HTMLElement | null> | ShallowRef<HTMLElement | null>;
    beginBatch?: () => void;
    endBatch?: () => void;
    visibleRange?: Ref<IVisibleRange | null>;
}
export interface UseFillHandleResult {
    fillDrag: ShallowRef<{
        startRow: number;
        startCol: number;
    } | null>;
    setFillDrag: (value: {
        startRow: number;
        startCol: number;
    } | null) => void;
    handleFillHandleMouseDown: (e: MouseEvent) => void;
}
/**
 * Manages Excel-style fill handle drag-to-fill for cell ranges.
 */
export declare function useFillHandle<T>(params: UseFillHandleParams<T>): UseFillHandleResult;
