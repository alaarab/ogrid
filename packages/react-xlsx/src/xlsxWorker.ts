import { readXlsxStream } from './streamingReader';
import type { XlsxStreamOptions } from './streamingTypes';

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (value: unknown) => void;
};
let acknowledge: (() => void) | undefined;
scope.onmessage = (event: MessageEvent<{ kind: string; blob: Blob; options: XlsxStreamOptions }>) => {
  if (event.data.kind === 'ack') { acknowledge?.(); acknowledge = undefined; return; }
  const { kind, blob, options } = event.data;
  void (async () => {
    try {
      if (kind === 'document') {
        // Only editing/exporting needs the full fidelity-preserving ExcelJS graph.
        const { workbookFromBlob, sheetToGridData, headerReferencingFormulas } = await import('./sheetMapper');
        const { readSheetNotes } = await import('./cellNotes');
        const workbook = await workbookFromBlob(blob, options);
        const model = workbook.model;
        const worksheets = model.worksheets as unknown as Array<import('exceljs').WorksheetModel & { rows: import('exceljs').RowModel[]; merges: string[] }>;
        scope.postMessage({ kind: 'model', model: { ...model, worksheets: worksheets.map((sheet) => ({ ...sheet, rows: [], merges: [], mergeCells: [] })) } });
        const send = (value: unknown) => new Promise<void>((resolve) => { acknowledge = resolve; scope.postMessage(value); });
        for (const sheet of worksheets) {
          for (let i = 0; i < sheet.rows.length; i += 128) await send({ kind: 'documentRows', sheetId: sheet.id, rows: sheet.rows.slice(i, i + 128) });
          for (let i = 0; i < sheet.merges.length; i += 128) await send({ kind: 'documentMerges', sheetId: sheet.id, merges: sheet.merges.slice(i, i + 128) });
          const worksheet = workbook.getWorksheet(sheet.id);
          if (!worksheet) continue;
          const source = sheetToGridData(worksheet, options);
          await send({ kind: 'preparedHeader', sheetName: sheet.name, source: { ...source, rows: [], initialFormulas: [], formatting: { ...source.formatting, styles: new Map(), rowHeights: new Map() } } });
          for (let i = 0; i < source.rows.length; i += 128) await send({ kind: 'preparedRows', sheetName: sheet.name, rows: source.rows.slice(i, i + 128) });
          const styles = [...source.formatting.styles];
          for (let i = 0; i < styles.length; i += 256) await send({ kind: 'preparedStyles', sheetName: sheet.name, styles: styles.slice(i, i + 256) });
          const heights = [...source.formatting.rowHeights];
          for (let i = 0; i < heights.length; i += 256) await send({ kind: 'preparedHeights', sheetName: sheet.name, heights: heights.slice(i, i + 256) });
          for (let i = 0; i < source.initialFormulas.length; i += 128) {
            const formulas = source.initialFormulas.slice(i, i + 128);
            await send({ kind: 'preparedFormulas', sheetName: sheet.name, formulas, headerReferences: formulas.map((f) => headerReferencingFormulas.has(f)) });
          }
          const notes = readSheetNotes(worksheet, source);
          for (let i = 0; i < notes.length; i += 128) await send({ kind: 'preparedNotes', sheetName: sheet.name, notes: notes.slice(i, i + 128) });
        }
      } else {
        await readXlsxStream(blob, {
          ...options,
          onProgress: (percent) => scope.postMessage({ kind: 'progress', percent }),
          onChunk: (chunk) => new Promise<void>((resolve) => {
            acknowledge = resolve;
            scope.postMessage({ kind: 'chunk', chunk });
          }),
        });
      }
      scope.postMessage({ kind: 'done' });
    } catch (error) {
      scope.postMessage({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  })();
};
