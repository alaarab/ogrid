import { useEffect, useMemo, useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import { OGrid } from '@alaarab/ogrid-react-radix';
import type { IOGridProps } from '@alaarab/ogrid-react-radix';
import { triggerBlobDownload } from '@alaarab/ogrid-core';
import type { IDataSource } from '@alaarab/ogrid-core';
import { XlsxWorkbookGrid, type XlsxWorkbookGridProps } from './XlsxWorkbookGrid';
import { sheetToGridData, type SheetRow } from './sheetMapper';
import { materializeStreamRows, streamWorkbook, type StreamedXlsxWorkbook, type XlsxStreamSheet } from './streamingClient';
import { columnLetter, streamLimit } from './streamingTypes';
import type { XlsxWorkbookDocument } from './xlsxDocument';

export default function StreamingWorkbookGrid(props: XlsxWorkbookGridProps & { blob: Blob }) {
  const { blob, headerRow, initialSheet, limits, streamOptions, editable, exportFileName, height = '100%', density = 'compact' } = props;
  const { maxRows, maxCols, maxCells, maxFileBytes, maxUncompressedBytes } = limits ?? {};
  const { workerFactory, chunkSize, maxSharedStringsBytes } = streamOptions ?? {};
  const [sheets, setSheets] = useState(new Map<string, XlsxStreamSheet>());
  const [active, setActive] = useState(initialSheet ?? '');
  const [percent, setPercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [csv, setCsv] = useState(false);
  const [result, setResult] = useState<StreamedXlsxWorkbook>();
  const [document, setDocument] = useState<XlsxWorkbookDocument>();
  const [preparing, setPreparing] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const sampleVersions = useRef(new Map<string, number>());
  const callbacks = useRef(props);
  callbacks.current = props;
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    const views = new Map<string, XlsxStreamSheet>();
    sampleVersions.current.clear();
    setSheets(views); setResult(undefined); setDocument(undefined); setPercent(0);
    setLoading(true); setCancelled(false); setCsv(false); setError(''); setPreparing(false);
    setActive(initialSheet ?? '');
    const options = { maxRows, maxCols, maxCells, maxFileBytes, maxUncompressedBytes, workerFactory, chunkSize, maxSharedStringsBytes, headerRow, signal: controller.signal };
    void (async () => {
      const magic = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      if (magic[0] !== 80 || magic[1] !== 75) { if (!controller.signal.aborted) setCsv(true); return; }
      const loaded = await streamWorkbook(blob, {
        ...options,
        onProgress: (value) => {
          if (controller.signal.aborted) return;
          setPercent(value); callbacks.current.onLoadProgress?.(value);
        },
        onChunk: async (chunk) => {
          if (controller.signal.aborted) return;
          let sheet = views.get(chunk.sheetName);
          if (!sheet) { sheet = { name: chunk.sheetName, rows: [], rowCount: 0, columnCount: 0, complete: false, truncated: false }; views.set(sheet.name, sheet); }
          sheet.rowCount = chunk.rowCount; sheet.columnCount = chunk.columnCount;
          sheet.complete = chunk.complete; sheet.truncated = chunk.truncated;
          for (const row of chunk.rows) sheet.rows[row.__rowIdx] = row;
          if (chunk.rows.some((row) => row.__rowIdx < 51)) sampleVersions.current.set(sheet.name, (sampleVersions.current.get(sheet.name) ?? 0) + 1);
          await materializeStreamRows(sheet, options);
          // A fresh sheet snapshot updates the viewport without copying all rows.
          setSheets(new Map([...views].map(([name, view]) => [name, { ...view }])));
          setActive((name) => name || chunk.sheetName);
          if (chunk.complete && chunk.truncated) {
            const mapped = previewColumns(sheet, options);
            callbacks.current.onTruncated?.({ sheetName: sheet.name, loadedRows: Math.max(0, sheet.rows.length - (mapped.formatting.headerPromoted ? 1 : 0)), loadedColumns: mapped.columns.length, rowCount: sheet.rowCount, columnCount: sheet.columnCount, parseTruncated: false });
          }
        },
      });
      if (controller.signal.aborted) return;
      setActive((name) => loaded.sheets.has(name) ? name : loaded.sheets.keys().next().value ?? '');
      setResult(loaded); setLoading(false); callbacks.current.onStreamedWorkbook?.(loaded);
    })().catch((reason) => {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : String(reason)); setLoading(false);
    });
    return () => controller.abort();
  }, [blob, headerRow, initialSheet, maxRows, maxCols, maxCells, maxFileBytes, maxUncompressedBytes, workerFactory, chunkSize, maxSharedStringsBytes]);

  const selected = sheets.get(active);
  const columnCount = selected?.columnCount ?? 0;
  const sampleRows = selected?.rows.slice(0, 51);
  // Stable columns avoid rebuilding grid chrome and the column model per chunk.
  const sampleKey = selected ? `${selected.name}:${columnCount}:${Math.min(selected.rows.length, 51)}:${sampleVersions.current.get(selected.name) ?? 0}` : '';
  const firstSampleRow = selected?.rows[0];
  const sampleRef = useRef(sampleRows);
  sampleRef.current = sampleRows;
  const mapped = useMemo(() => sampleKey ? previewColumns({ name: sampleKey, rows: [firstSampleRow, ...sampleRef.current?.slice(1) ?? []].filter((row): row is SheetRow => !!row), columnCount, rowCount: sampleRef.current?.length ?? 0, complete: false, truncated: false }, { headerRow, maxCols, maxRows, maxCells }) : undefined, [sampleKey, firstSampleRow, columnCount, headerRow, maxCols, maxRows, maxCells]);
  const offset = mapped?.formatting.headerPromoted ? 1 : 0;
  const rowCount = Math.max(0, (selected?.rows.length ?? 0) - offset);
  // A windowed source avoids rebuilding OGrid's full row-order snapshot as
  // every chunk arrives. Only the viewport is copied into grid state.
  const dataSource = useMemo<IDataSource<SheetRow> | undefined>(() => selected ? {
    getRowCount: async () => rowCount,
    getRows: async ({ start, end }) => ({ items: selected.rows.slice(start + offset, end + offset), totalCount: rowCount }),
  } : undefined, [selected, rowCount, offset]);
  const enableEditing = async () => {
    if (!result) return;
    const controller = abort.current;
    setPreparing(true);
    try {
      const doc = await result.loadDocument(controller?.signal);
      if (controller?.signal.aborted) return;
      setDocument(doc);
      setSheets(new Map()); setResult(undefined);
    } catch (reason) {
      if (!controller?.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
    } finally { if (abort.current === controller) setPreparing(false); }
  };
  const cancel = () => { abort.current?.abort(); setCancelled(true); setLoading(false); setPreparing(false); setSheets(new Map()); setResult(undefined); };
  if (csv) return <XlsxWorkbookGrid {...props} streaming={false} />;
  if (error) return <div role="alert">Could not parse workbook: {error}</div>;
  if (cancelled) return <div role="status">Workbook loading cancelled.</div>;
  if (document) return <XlsxWorkbookGrid {...props} blob={undefined as never} workbook={document.workbook} document={document} initialSheet={active} streaming={false} onDocument={callbacks.current.onDocument} />;
  const rowHeight = density === 'compact' ? 28 : density === 'comfortable' ? 44 : 36;
  const gridProps = {
    dataSource, columns: mapped?.columns ?? [], getRowId: (row: SheetRow) => row.__rowIdx,
    defaultSortBy: '', cellReferences: true, density, rowHeight,
    virtualScroll: { enabled: true, paginate: false, rowHeight, columns: (mapped?.columns.length ?? 0) > 100 },
    statusBar: true, columnChooser: false,
  } as unknown as IOGridProps<unknown>;
  return (
    <div style={{ height, width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 12, padding: 8, alignItems: 'center' }}>
        {loading && <><span role="status">Loading… {percent}%</span><progress aria-label="Workbook loading" max={100} value={percent} /><button type="button" onClick={cancel}>Cancel</button></>}
        {preparing && <><span role="status">Preparing editable workbook…</span><button type="button" onClick={cancel}>Cancel</button></>}
        {editable && !preparing && <button type="button" disabled={loading || !result} onClick={() => { void enableEditing(); }}>Enable editing</button>}
        {exportFileName && <button type="button" disabled={loading || !result || preparing} onClick={() => { if (result) void result.toBlob().then((saved) => triggerBlobDownload(saved, exportFileName)).catch((reason) => setError(String(reason))); }}>Export</button>}
        {!loading && !preparing && <span>{rowCount.toLocaleString()} rows loaded{selected?.truncated ? ' (load limit reached)' : ''}</span>}
      </div>
      {sheets.size > 1 && <nav style={{ display: 'flex', gap: 4, padding: 8 }} aria-label="Workbook sheets">{[...sheets.keys()].map((name) => <button type="button" key={name} aria-pressed={active === name} onClick={() => { setActive(name); callbacks.current.onSheetChange?.(name); }}>{name}</button>)}</nav>}
      {mapped && <OGrid key={active} {...gridProps} />}
      {!loading && !sheets.size && <div>Workbook has no sheets.</div>}
    </div>
  );
}

function previewColumns(sheet: XlsxStreamSheet, options: import('./streamingTypes').XlsxStreamOptions) {
  const workbook = new ExcelJS.Workbook();
  const sample = workbook.addWorksheet('Preview');
  const columns = Math.min(sheet.columnCount, streamLimit(options.maxCols, 1000), streamLimit(options.maxCells, 5_100_000));
  const letters = Array.from({ length: columns }, (_, i) => columnLetter(i));
  for (const row of sheet.rows.slice(0, 51)) sample.addRow(letters.map((letter) => row?.[letter] as ExcelJS.CellValue));
  const mapped = sheetToGridData(sample, options, { rowCount: Math.min(sheet.rows.length, 51), columnCount: columns });
  mapped.columns = mapped.columns.map((column) => ({ ...column, sortable: false }));
  return mapped;
}
