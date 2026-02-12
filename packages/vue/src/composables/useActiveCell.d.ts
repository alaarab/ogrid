import { type Ref, type ShallowRef } from 'vue';
import type { IActiveCell, RowId } from '../types';
export interface UseActiveCellResult {
    activeCell: ShallowRef<IActiveCell | null>;
    setActiveCell: (cell: IActiveCell | null) => void;
}
/**
 * Tracks the active cell for keyboard navigation.
 * When wrapperRef and editingCell are provided, scrolls the active cell into view when it changes (and not editing).
 */
export declare function useActiveCell(wrapperRef?: Ref<HTMLElement | null> | ShallowRef<HTMLElement | null>, editingCell?: Ref<{
    rowId: RowId;
    columnId: string;
} | null>): UseActiveCellResult;
