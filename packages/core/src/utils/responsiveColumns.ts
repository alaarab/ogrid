import type { IColumnMeta } from '../types/columnTypes';

/**
 * Default breakpoints for responsive column hiding.
 * Each threshold maps a minimum container width (px) to how many responsive
 * priority levels are visible. At 0px all priority-0 columns are shown;
 * wider containers show progressively more columns.
 *
 * Example with default thresholds:
 *   container < 576px  → show only priority 0
 *   container < 768px  → show priority 0–1
 *   container < 992px  → show priority 0–2
 *   container < 1200px → show priority 0–3
 *   container ≥ 1200px → show all (no limit)
 */
export const RESPONSIVE_BREAKPOINTS: readonly { minWidth: number; maxPriority: number }[] = [
  { minWidth: 0, maxPriority: 0 },
  { minWidth: 576, maxPriority: 1 },
  { minWidth: 768, maxPriority: 2 },
  { minWidth: 992, maxPriority: 3 },
  { minWidth: 1200, maxPriority: Infinity },
];

export interface IResponsiveColumnsConfig {
  /** Custom breakpoints (ascending by minWidth). When omitted, uses RESPONSIVE_BREAKPOINTS. */
  breakpoints?: readonly { minWidth: number; maxPriority: number }[];
}

/**
 * Pure function: given a container width and column definitions, returns the set
 * of column IDs that should be hidden due to responsive priority.
 *
 * Columns WITHOUT `responsivePriority` are never hidden.
 * Columns with `required: true` are never hidden.
 *
 * @returns Set of columnIds to hide. Empty set means no responsive hiding.
 */
export function getResponsiveHiddenColumns<T extends IColumnMeta>(
  containerWidth: number,
  columns: readonly T[],
  config?: IResponsiveColumnsConfig,
): Set<string> {
  const breakpoints = config?.breakpoints ?? RESPONSIVE_BREAKPOINTS;
  const hidden = new Set<string>();

  if (containerWidth <= 0 || columns.length === 0) return hidden;

  // Find the max priority allowed for the current container width.
  // Walk breakpoints from highest to lowest; first match wins.
  let maxPriority = Infinity;
  for (let i = breakpoints.length - 1; i >= 0; i--) {
    if (containerWidth >= breakpoints[i].minWidth) {
      maxPriority = breakpoints[i].maxPriority;
      break;
    }
  }

  if (maxPriority === Infinity) return hidden; // show everything

  for (const col of columns) {
    if (col.responsivePriority == null) continue; // no priority → always visible
    if (col.required) continue; // required → never hidden
    if (col.responsivePriority > maxPriority) {
      hidden.add(col.columnId);
    }
  }

  return hidden;
}
