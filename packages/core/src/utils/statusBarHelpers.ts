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
}

/**
 * Returns an array of status bar parts (Rows, Filtered, Selected) for consistent rendering across packages.
 */
export function getStatusBarParts(input: StatusBarPartsInput): StatusBarPart[] {
  const { totalCount, filteredCount, selectedCount, selectedCellCount } = input;
  const parts: StatusBarPart[] = [];

  parts.push({ key: 'total', label: 'Rows:', value: totalCount });

  if (filteredCount !== undefined && filteredCount !== totalCount) {
    parts.push({ key: 'filtered', label: 'Filtered:', value: filteredCount });
  }

  if (selectedCount !== undefined && selectedCount > 0) {
    parts.push({ key: 'selected', label: 'Selected:', value: selectedCount });
  }

  if (selectedCellCount !== undefined && selectedCellCount > 1) {
    parts.push({ key: 'cells', label: 'Cells:', value: selectedCellCount });
  }

  return parts;
}
