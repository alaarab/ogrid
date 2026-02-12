import type { IColumnDef, IColumnGroupDef, HeaderRow } from '../types/columnTypes';
/**
 * Flattens a tree of column groups and column definitions into a single array of leaf columns.
 * Used for body rendering and when the grid accepts grouped columns.
 */
export declare function flattenColumns<T>(columns: (IColumnGroupDef<T> | IColumnDef<T>)[]): IColumnDef<T>[];
/**
 * Builds an array of header rows from a column tree for multi-row <thead> rendering.
 *
 * - Flat columns (no groups) produce a single row of leaf cells.
 * - Grouped columns produce N rows where N = max nesting depth + 1.
 * - Group cells get colSpan = number of visible leaf descendants.
 * - Leaf cells at a depth shallower than maxDepth are placed at their own depth
 *   (the rendering layer can use rowSpan to stretch them down to the bottom row).
 * - If visibleColumns is provided, only visible leaf columns and their ancestors are included.
 *
 * @param columns - The column tree (mix of IColumnDef and IColumnGroupDef)
 * @param visibleColumns - Optional set of visible column ids (filters out hidden leaves + empty groups)
 * @returns Array of HeaderRow, from top (group headers) to bottom (leaf columns)
 */
export declare function buildHeaderRows<T>(columns: (IColumnGroupDef<T> | IColumnDef<T>)[], visibleColumns?: Set<string>): HeaderRow<T>[];
