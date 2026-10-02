import type { StatusBarPanel } from '../types';

/**
 * Shared logic for status bar panels. Used by Fluent, Material, and Radix StatusBar components.
 */
export interface StatusBarPart {
  key: string;
  label: string;
  value: number;
}

export interface StatusBarPartsInput {
  totalCount: number;
  filteredCount?: number;
  selectedCount?: number;
  selectedCellCount?: number;
  /** Aggregation of selected numeric cells. */
  aggregation?: {
    sum: number;
    avg: number;
    min: number;
    max: number;
    count: number;
  } | null;
  /** When true, hides the "Rows: X" label (e.g. when pagination already shows it). */
  suppressRowCount?: boolean;
  /** Which row panels to show (default: all applicable). */
  panels?: StatusBarPanel[];
}

/**
 * Returns an array of status bar parts (Rows, Filtered, Selected) for consistent rendering across packages.
 */
export function getStatusBarParts(input: StatusBarPartsInput): StatusBarPart[] {
  const { totalCount, filteredCount, selectedCount, selectedCellCount, aggregation, suppressRowCount, panels } = input;
  const parts: StatusBarPart[] = [];

  const showPanel = (panel: StatusBarPanel): boolean =>
    panels === undefined || panels.includes(panel);

  if (!suppressRowCount && showPanel('rowCount')) {
    parts.push({ key: 'total', label: 'Rows:', value: totalCount });
  }

  if (filteredCount !== undefined && filteredCount !== totalCount && showPanel('filteredRowCount')) {
    parts.push({ key: 'filtered', label: 'Filtered:', value: filteredCount });
  }

  if (selectedCount !== undefined && selectedCount > 0 && showPanel('selectedRowCount')) {
    parts.push({ key: 'selected', label: 'Selected:', value: selectedCount });
  }

  if (selectedCellCount !== undefined && selectedCellCount > 1) {
    parts.push({ key: 'cells', label: 'Cells:', value: selectedCellCount });
  }

  if (aggregation) {
    parts.push({ key: 'sum', label: 'Sum:', value: aggregation.sum });
    parts.push({ key: 'avg', label: 'Avg:', value: Math.round(aggregation.avg * 100) / 100 });
    parts.push({ key: 'min', label: 'Min:', value: aggregation.min });
    parts.push({ key: 'max', label: 'Max:', value: aggregation.max });
    parts.push({ key: 'count', label: 'Count:', value: aggregation.count });
  }

  return parts;
}
