import { type Ref, type ShallowRef } from 'vue';
import type { ISelectionRange, IActiveCell } from '../types';
export interface UseCellSelectionParams {
    colOffset: number;
    rowCount: Ref<number>;
    visibleColCount: Ref<number>;
    setActiveCell: (cell: IActiveCell | null) => void;
    wrapperRef: Ref<HTMLElement | null> | ShallowRef<HTMLElement | null>;
}
export interface UseCellSelectionResult {
    selectionRange: ShallowRef<ISelectionRange | null>;
    setSelectionRange: (range: ISelectionRange | null) => void;
    handleCellMouseDown: (e: MouseEvent, rowIndex: number, globalColIndex: number) => void;
    handleSelectAllCells: () => void;
    isDragging: Ref<boolean>;
}
/**
 * Manages cell selection range with drag-to-select and select-all support.
 */
export declare function useCellSelection(params: UseCellSelectionParams): UseCellSelectionResult;
