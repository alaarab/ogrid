import type { WorkbookLoadOptions, SheetRow } from './sheetMapper';

export interface XlsxStreamSheet {
  name: string;
  /** Worksheet coordinates, including a possible header row. */
  rowCount: number;
  columnCount: number;
  rows: SheetRow[];
  complete: boolean;
  truncated: boolean;
}

export type XlsxStreamChunk = {
  sheetName: string;
  rows: SheetRow[];
  rowCount: number;
  columnCount: number;
  complete: boolean;
  truncated: boolean;
};

export interface XlsxStreamOptions extends WorkbookLoadOptions {
  signal?: AbortSignal;
  /** Awaited before more chunks are delivered: consumers can apply backpressure. */
  onChunk?: (chunk: XlsxStreamChunk) => void | Promise<void>;
  onProgress?: (percent: number) => void;
  /** Defaults to 256 rows. Clamped to 1–4096. */
  chunkSize?: number;
  /** Decoded shared-string text budget (default 32 MiB). */
  maxSharedStringsBytes?: number;
  /** Override worker creation for CSP or custom asset hosting. null uses the fallback. */
  workerFactory?: (() => Worker) | null;
}

export function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Workbook loading cancelled', 'AbortError');
}

export function streamLimit(value: number | undefined, fallback: number): number {
  return value === undefined || Number.isNaN(value) ? fallback : Math.max(1, Math.floor(value));
}

export function columnLetter(index: number): string {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}
