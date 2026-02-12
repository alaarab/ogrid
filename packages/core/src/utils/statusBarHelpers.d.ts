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
}
/**
 * Returns an array of status bar parts (Rows, Filtered, Selected) for consistent rendering across packages.
 */
export declare function getStatusBarParts(input: StatusBarPartsInput): StatusBarPart[];
