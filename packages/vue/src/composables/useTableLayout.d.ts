import { type Ref, type ShallowRef } from 'vue';
import type { IColumnDef } from '../types';
export interface UseTableLayoutParams<T> {
    wrapperRef: Ref<HTMLElement | null> | ShallowRef<HTMLElement | null>;
    visibleCols: Ref<IColumnDef<T>[]>;
    flatColumns: Ref<IColumnDef<T>[]>;
    hasCheckboxCol: Ref<boolean>;
    initialColumnWidths?: Record<string, number>;
    onColumnResized?: (columnId: string, width: number) => void;
}
export interface UseTableLayoutResult {
    containerWidth: Ref<number>;
    minTableWidth: Ref<number>;
    desiredTableWidth: Ref<number>;
    columnSizingOverrides: Ref<Record<string, {
        widthPx: number;
    }>>;
    setColumnSizingOverrides: (value: Record<string, {
        widthPx: number;
    }>) => void;
    onColumnResized?: (columnId: string, width: number) => void;
}
/**
 * Manages table layout: container width measurement, column sizing overrides,
 * min/desired table width calculations.
 */
export declare function useTableLayout<T>(params: UseTableLayoutParams<T>): UseTableLayoutResult;
