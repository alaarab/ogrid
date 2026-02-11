import type { IStatusBarProps } from '../types';

/**
 * Derives status bar config for DataGridTable from props + current items/selection.
 * Use in Fluent, Material, and Radix DataGridTable so the same logic lives in one place.
 */
export function getDataGridStatusBarConfig(
  statusBar: boolean | IStatusBarProps | undefined,
  itemsLength: number,
  selectedCount: number,
  filteredCount?: number
): IStatusBarProps | null {
  if (!statusBar) return null;
  if (typeof statusBar === 'object') return statusBar;
  return {
    totalCount: itemsLength,
    selectedCount: selectedCount > 0 ? selectedCount : undefined,
    filteredCount:
      filteredCount !== undefined && filteredCount !== itemsLength ? filteredCount : undefined,
  };
}
