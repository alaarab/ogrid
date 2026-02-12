import { type Ref } from 'vue';
import type { IColumnDefinition } from '../types';
export interface UseColumnChooserStateParams {
    columns: Ref<IColumnDefinition[]>;
    visibleColumns: Ref<Set<string>>;
    onVisibilityChange: (columnKey: string, visible: boolean) => void;
}
export interface UseColumnChooserStateResult {
    open: Ref<boolean>;
    setOpen: (open: boolean) => void;
    handleToggle: () => void;
    handleClose: () => void;
    handleCheckboxChange: (columnKey: string) => (visible: boolean) => void;
    handleSelectAll: () => void;
    handleClearAll: () => void;
    visibleCount: Ref<number>;
    totalCount: Ref<number>;
}
/**
 * Returns open/setOpen, handleToggle, handleClose, handleCheckboxChange, handleSelectAll, handleClearAll.
 */
export declare function useColumnChooserState(params: UseColumnChooserStateParams): UseColumnChooserStateResult;
