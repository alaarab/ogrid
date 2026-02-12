export interface CsvColumn {
    columnId: string;
    name: string;
}
export declare function escapeCsvValue(value: unknown): string;
export declare function buildCsvHeader(columns: CsvColumn[]): string;
export declare function buildCsvRows<T>(items: T[], columns: CsvColumn[], getValue: (item: T, columnId: string) => string): string[];
export declare function exportToCsv<T>(items: T[], columns: CsvColumn[], getValue: (item: T, columnId: string) => string, filename?: string): void;
export declare function triggerCsvDownload(csvContent: string, filename: string): void;
