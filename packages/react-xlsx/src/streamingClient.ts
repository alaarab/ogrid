import type ExcelJS from 'exceljs';
import type { XlsxWorkbookDocument, PreparedXlsxSheet } from './xlsxDocument';
import { checkAbort, streamLimit, type XlsxStreamChunk, type XlsxStreamOptions, type XlsxStreamSheet } from './streamingTypes';
import type { SheetRow, SheetGridData } from './sheetMapper';
import type { XlsxCellStyle } from './cellStyles';
import type { ICellNote } from '@alaarab/ogrid-core';

export type { XlsxStreamOptions, XlsxStreamChunk, XlsxStreamSheet } from './streamingTypes';

/** Value preview plus the original file; the full document is created only on demand. */
export interface StreamedXlsxWorkbook {
  readonly sheets: Map<string, XlsxStreamSheet>;
  /** Load in a worker, then hydrate the editable model in yielding batches. */
  loadDocument: (signal?: AbortSignal) => Promise<XlsxWorkbookDocument>;
  /** Unedited export returns the original file byte-for-byte, including unsupported parts. */
  toBlob: () => Promise<Blob>;
}

async function createWorker(options: XlsxStreamOptions): Promise<Worker | null> {
  if (options.workerFactory === null || (options.workerFactory === undefined && typeof Worker === 'undefined')) return null;
  try {
    return options.workerFactory ? options.workerFactory() : (await import('./xlsxWorkerFactory')).createXlsxWorker();
  } catch {
    // CSP and browser policy can reject construction even when Worker exists.
    return null;
  }
}

function wireOptions(options: XlsxStreamOptions) {
  const { signal: _signal, onChunk: _chunk, onProgress: _progress, workerFactory: _factory, ...serializable } = options;
  return serializable;
}

async function workerRequest(
  worker: Worker, blob: Blob, options: XlsxStreamOptions, kind: 'stream' | 'document', workbook?: ExcelJS.Workbook,
  preparedSheets?: Map<string, PreparedXlsxSheet>, headerReferences?: WeakSet<object>,
): Promise<ExcelJS.WorkbookModel | undefined> {
  if (options.signal?.aborted) { worker.terminate(); checkAbort(options.signal); }
  return new Promise((resolve, reject) => {
    let model: ExcelJS.WorkbookModel | undefined;
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error); else resolve(model);
    };
    const abort = () => finish(new DOMException('Workbook loading cancelled', 'AbortError'));
    options.signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = (event) => { event.preventDefault(); finish(new Error(event.message || 'XLSX worker failed')); };
    worker.onmessageerror = () => finish(new Error('Could not receive XLSX worker data'));
    worker.onmessage = (event) => {
      if (settled) return;
      const data = event.data;
      if (data.kind === 'error') finish(new Error(data.message));
      else if (data.kind === 'model') {
        model = data.model;
        try { if (workbook && model) workbook.model = model; } catch (error) { finish(error); }
      }
      else if (data.kind === 'done') finish();
      else if (data.kind === 'progress') {
        try { options.onProgress?.(data.percent); } catch (error) { finish(error); }
      } else if (data.kind === 'chunk' || data.kind === 'documentRows' || data.kind === 'documentMerges' || data.kind.startsWith('prepared')) {
        Promise.resolve().then(async () => {
          if (data.kind === 'chunk') await options.onChunk?.(data.chunk);
          else if (data.kind.startsWith('prepared')) {
            if (data.kind === 'preparedHeader') preparedSheets?.set(data.sheetName, { source: data.source, notes: [] });
            const prepared = preparedSheets?.get(data.sheetName);
            if (!prepared) throw new Error('Missing prepared XLSX sheet');
            if (data.kind === 'preparedRows') prepared.source.rows.push(...data.rows as SheetRow[]);
            if (data.kind === 'preparedStyles') for (const [key, style] of data.styles as Array<[string, XlsxCellStyle]>) prepared.source.formatting.styles.set(key, style);
            if (data.kind === 'preparedHeights') for (const [key, height] of data.heights as Array<[number, number]>) prepared.source.formatting.rowHeights.set(key, height);
            if (data.kind === 'preparedNotes') prepared.notes.push(...data.notes as ICellNote[]);
            if (data.kind === 'preparedFormulas') {
              const formulas = data.formulas as SheetGridData['initialFormulas'];
              formulas.forEach((f, i) => { if (data.headerReferences[i]) headerReferences?.add(f); });
              prepared.source.initialFormulas.push(...formulas);
            }
            await new Promise<void>((done) => setTimeout(done, 0));
          } else {
            const target = workbook?.getWorksheet(data.sheetId);
            if (data.kind === 'documentRows' && target) for (const row of data.rows as ExcelJS.RowModel[]) target.getRow(row.number).model = row;
            if (data.kind === 'documentMerges' && target) for (const merge of data.merges as string[]) target.mergeCellsWithoutStyle(merge);
            await new Promise<void>((done) => setTimeout(done, 0));
          }
        }).then(() => {
          if (!settled) worker.postMessage({ kind: 'ack' });
        }).catch(finish);
      }
    };
    try { worker.postMessage({ kind, blob, options: wireOptions(options) }); } catch (error) { finish(error); }
  });
}

async function loadDocument(blob: Blob, options: XlsxStreamOptions, signal?: AbortSignal): Promise<XlsxWorkbookDocument> {
  const loadOptions = { ...options, signal };
  checkAbort(signal);
  const worker = await createWorker(loadOptions);
  const preparedSheets = new Map<string, PreparedXlsxSheet>();
  let workbook: ExcelJS.Workbook;
  if (worker) {
    const { default: Excel } = await import('exceljs');
    const { headerReferencingFormulas } = await import('./sheetMapper');
    workbook = new Excel.Workbook();
    const model = await workerRequest(worker, blob, loadOptions, 'document', workbook, preparedSheets, headerReferencingFormulas);
    if (!model) throw new Error('XLSX worker returned no document');
  } else {
    const { workbookFromBlob } = await import('./sheetMapper');
    workbook = await workbookFromBlob(blob, options);
  }
  checkAbort(signal);
  const { XlsxWorkbookDocument: Document } = await import('./xlsxDocument');
  return new Document(workbook, options, preparedSheets);
}

/** Stream XLSX values off-thread, or cooperatively on the main thread without Workers. */
export async function streamWorkbook(blob: Blob, options: XlsxStreamOptions = {}): Promise<StreamedXlsxWorkbook> {
  checkAbort(options.signal);
  if (blob.size > streamLimit(options.maxFileBytes, 50 * 1024 ** 2)) throw new Error('File exceeds maxFileBytes');
  const sheets = new Map<string, XlsxStreamSheet>();
  const onChunk = async (chunk: XlsxStreamChunk) => {
    let sheet = sheets.get(chunk.sheetName);
    if (!sheet) {
      sheet = { name: chunk.sheetName, rows: [], rowCount: 0, columnCount: 0, complete: false, truncated: false };
      sheets.set(chunk.sheetName, sheet);
    }
    // Keep sparse worksheet coordinates until the final populated extent is known.
    for (const row of chunk.rows) sheet.rows[row.__rowIdx] = row;
    sheet.rowCount = chunk.rowCount; sheet.columnCount = chunk.columnCount;
    sheet.complete = chunk.complete; sheet.truncated = chunk.truncated;
    await options.onChunk?.(chunk);
  };
  const worker = await createWorker(options);
  if (worker) await workerRequest(worker, blob, { ...options, onChunk }, 'stream');
  else {
    const { readXlsxStream } = await import('./streamingReader');
    await readXlsxStream(blob, { ...options, onChunk });
  }
  for (const sheet of sheets.values()) await materializeStreamRows(sheet, options);
  // Release consumer callbacks and their preview buffers after transport ends.
  options = { ...wireOptions(options), workerFactory: options.workerFactory };
  let document: XlsxWorkbookDocument | undefined;
  let pending: Promise<XlsxWorkbookDocument> | undefined;
  return {
    sheets,
    loadDocument: (signal) => {
      if (document) return Promise.resolve(document);
      if (!pending) pending = loadDocument(blob, options, signal).then((loaded) => { document = loaded; return loaded; }).catch((error) => { pending = undefined; throw error; });
      return pending;
    },
    toBlob: () => document ? document.toBlob() : Promise.resolve(blob),
  };
}

/** Fill missing cells/rows only within the configured grid rectangle. */
const materialized = new WeakMap<XlsxStreamSheet, { columns: number; count: number }>();
export async function materializeStreamRows(sheet: XlsxStreamSheet, options: XlsxStreamOptions): Promise<SheetRow[]> {
  const columns = Math.min(sheet.columnCount, streamLimit(options.maxCols, 1000), streamLimit(options.maxCells, 5_100_000));
  const count = Math.min(sheet.rowCount, streamLimit(options.maxRows, 1_048_576), columns ? Math.floor(streamLimit(options.maxCells, 5_100_000) / columns) : 0);
  const { columnLetter } = await import('./streamingTypes');
  const letters = Array.from({ length: columns }, (_, i) => columnLetter(i));
  const previous = materialized.get(sheet);
  sheet.rows.length = count;
  for (let i = previous?.columns === columns ? Math.min(count, previous.count) : 0; i < count; i++) {
    checkAbort(options.signal);
    const row: SheetRow = sheet.rows[i] ?? { __rowIdx: i };
    for (const letter of letters) if (!(letter in row)) row[letter] = '';
    sheet.rows[i] = row;
    if (i % 512 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  materialized.set(sheet, { columns, count });
  return sheet.rows;
}
