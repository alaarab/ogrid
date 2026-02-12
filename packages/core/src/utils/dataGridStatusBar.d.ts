import type { IStatusBarProps } from '../types';
/**
 * Derives status bar config for DataGridTable from props + current items/selection.
 * Use in Fluent, Material, and Radix DataGridTable so the same logic lives in one place.
 */
export declare function getDataGridStatusBarConfig(statusBar: boolean | IStatusBarProps | undefined, itemsLength: number, selectedCount: number, filteredCount?: number): IStatusBarProps | null;
