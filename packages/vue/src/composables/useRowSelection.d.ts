import { type Ref } from 'vue';
import type { RowId, RowSelectionMode, IRowSelectionChangeEvent } from '../types';
export interface UseRowSelectionParams<T> {
    items: Ref<T[]>;
    getRowId: (item: T) => RowId;
    rowSelection: Ref<RowSelectionMode>;
    controlledSelectedRows: Ref<Set<RowId> | undefined>;
    onSelectionChange: ((event: IRowSelectionChangeEvent<T>) => void) | undefined;
}
export interface UseRowSelectionResult {
    selectedRowIds: Ref<Set<RowId>>;
    updateSelection: (newSelectedIds: Set<RowId>) => void;
    handleRowCheckboxChange: (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
    handleSelectAll: (checked: boolean) => void;
    allSelected: Ref<boolean>;
    someSelected: Ref<boolean>;
}
/**
 * Manages row selection state for single or multiple selection modes with shift-click range support.
 */
export declare function useRowSelection<T>(params: UseRowSelectionParams<T>): UseRowSelectionResult;
