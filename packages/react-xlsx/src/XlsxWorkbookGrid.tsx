// Multi-sheet wrapper. Accepts either a Blob (parsed lazily on mount)
// or a pre-parsed WorkBook. Renders a sheet-tab strip across the top
// and the active sheet's grid below.

import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import type ExcelJS from 'exceljs';
import { WorkbookSheetTabs } from './WorkbookSheetTabs';
import { XlsxGrid, type XlsxGridProps } from './XlsxGrid';
import { tabColorOf, workbookFromBlob, type SheetToGridDataOptions } from './sheetMapper';
import { XlsxWorkbookDocument } from './xlsxDocument';
import type { StreamedXlsxWorkbook, XlsxStreamOptions } from './streamingClient';

type Source = { blob: Blob } | { workbook: ExcelJS.Workbook };

export type XlsxWorkbookGridProps = Source & {
  /** Progressive worker preview. Defaults to true for Blobs of at least 1 MiB without onDocument. */
  streaming?: boolean;
  /** Custom worker hosting, chunk size and shared-string budget. */
  streamOptions?: Pick<XlsxStreamOptions, 'workerFactory' | 'chunkSize' | 'maxSharedStringsBytes'>;
  /** Receives the completed preview and its lazy document/export methods. */
  onStreamedWorkbook?: (workbook: StreamedXlsxWorkbook) => void;
  onLoadProgress?: (percent: number) => void;
  /** Reuse a prepared document (for example after a streaming preview). */
  document?: XlsxWorkbookDocument;
  /** CSS height of the whole component. Defaults to '100%'. */
  height?: number | string;
  /** Initial sheet to display. Defaults to the first sheet. */
  initialSheet?: string;
  density?: 'compact' | 'normal' | 'comfortable';
  /** Called when the user switches sheets. */
  onSheetChange?: (sheetName: string) => void;
  /** See {@link SheetToGridDataOptions.headerRow}. Defaults to 'auto'. */
  headerRow?: SheetToGridDataOptions['headerRow'];
  /** Per-sheet load limits; see {@link XlsxGridProps.limits}. */
  limits?: XlsxGridProps['limits'];
  onTruncated?: XlsxGridProps['onTruncated'];
  /** Allow cell editing. Defaults to false (read-only preview). */
  editable?: boolean;
  /** Show the formatting toolbar. Defaults to `editable`. */
  toolbar?: boolean;
  /** When set, the toolbar shows an Export button that downloads the workbook under this name. */
  exportFileName?: string;
  /**
   * Called with the editable document once the workbook is loaded (and again
   * when it is replaced). Keep it to export: `await doc.toBlob()`.
   * Supplying this disables automatic streaming. With explicit `streaming: true`,
   * delivery is deferred until Enable editing prepares the full document.
   */
  onDocument?: (document: XlsxWorkbookDocument) => void;
};

const StreamingWorkbookGrid = lazy(() => import('./StreamingWorkbookGrid'));

export function XlsxWorkbookGrid(props: XlsxWorkbookGridProps) {
  if ('blob' in props && props.blob && (props.streaming ?? (!props.onDocument && props.blob.size >= 1024 ** 2))) {
    return <Suspense fallback={<div style={loadingStyle}>Loading workbook…</div>}><StreamingWorkbookGrid {...props} blob={props.blob} /></Suspense>;
  }
  return <LoadedWorkbookGrid {...props} />;
}

function LoadedWorkbookGrid(props: XlsxWorkbookGridProps) {
  const { height = '100%', initialSheet, density, onSheetChange, headerRow, limits, onTruncated, editable, toolbar, exportFileName, onDocument, document: documentProp } = props;
  const sourceBlob = 'blob' in props ? props.blob : null;
  const sourceWorkbook = 'workbook' in props ? props.workbook : null;
  const [workbook, setWorkbook] = useState<ExcelJS.Workbook | null>(sourceWorkbook);
  const [error, setError] = useState<string | null>(null);
  const { maxRows, maxCols, maxCells, maxFileBytes, maxUncompressedBytes } = limits ?? {};

  useEffect(() => {
    if (sourceWorkbook) {
      setError(null);
      setWorkbook(sourceWorkbook);
      return;
    }
    if (!sourceBlob) {
      setWorkbook(null);
      setError('A workbook or blob is required');
      return;
    }
    let cancelled = false;
    setError(null);
    // Drop the previous file's workbook so it isn't shown (and editable)
    // while the new one parses.
    setWorkbook(null);
    workbookFromBlob(sourceBlob, { maxRows, maxCols, maxCells, maxFileBytes, maxUncompressedBytes })
      .then((wb) => { if (!cancelled) setWorkbook(wb); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
    return () => { cancelled = true; };
  }, [sourceBlob, sourceWorkbook, maxRows, maxCols, maxCells, maxFileBytes, maxUncompressedBytes]);

  const sheetNames = useMemo(
    () => workbook?.worksheets.map((w) => w.name) ?? [],
    [workbook],
  );
  // One document per loaded workbook and mapping options: edits survive sheet switches.
  const doc = useMemo(
    () => documentProp ?? (workbook ? new XlsxWorkbookDocument(workbook, { headerRow, maxRows, maxCols, maxCells }) : null),
    [documentProp, workbook, headerRow, maxRows, maxCols, maxCells],
  );
  const onDocumentRef = useRef(onDocument);
  onDocumentRef.current = onDocument;
  useEffect(() => {
    if (doc) onDocumentRef.current?.(doc);
  }, [doc]);
  const tabColors = useMemo(
    () => new Map(workbook?.worksheets.map((w) => [w.name, tabColorOf(w)]) ?? []),
    [workbook],
  );
  const [active, setActive] = useState<string | null>(null);
  const idBase = useId();
  const selectSheet = (name: string) => {
    setActive(name);
    onSheetChange?.(name);
  };

  // Pick the initial sheet once the workbook is in.
  useEffect(() => {
    if (!sheetNames.length) { setActive(null); return; }
    const wanted = initialSheet && sheetNames.includes(initialSheet) ? initialSheet : (sheetNames[0] ?? null);
    setActive(wanted);
  }, [sheetNames, initialSheet]);

  if (error) {
    return <div style={errorStyle}>Could not parse workbook: {error}</div>;
  }
  if (workbook && sheetNames.length === 0) {
    return <div style={loadingStyle}>Workbook has no sheets.</div>;
  }
  if (!workbook || !active || !doc) {
    return <div style={loadingStyle}>Loading workbook…</div>;
  }

  return (
    <div style={{ ...rootStyle, height }}>
      <WorkbookSheetTabs sheetNames={sheetNames} active={active} onSelect={selectSheet} idBase={idBase} tabColors={tabColors} />
      <div
        style={gridWrapStyle}
        id={`${idBase}-panel`}
        {...(sheetNames.length > 1
          ? { role: 'tabpanel', 'aria-labelledby': `${idBase}-tab-${sheetNames.indexOf(active)}` }
          : {})}
      >
        <XlsxGrid
          key={active}
          workbook={workbook}
          document={doc}
          sheetName={active}
          density={density}
          headerRow={headerRow}
          limits={limits}
          onTruncated={onTruncated}
          editable={editable}
          toolbar={toolbar}
          exportFileName={exportFileName}
        />
      </div>
    </div>
  );
}

// Inline styles inherit halo-explorer's CSS vars when available; fall
// back to neutral colors. Keeping styles inline so consumers don't need
// to import a separate stylesheet.
const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  minHeight: 0,
  background: 'var(--bg, transparent)',
  color: 'var(--fg, inherit)',
};

const gridWrapStyle: React.CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  display: 'flex',
};
const loadingStyle: React.CSSProperties = {
  margin: 'auto', padding: 40, textAlign: 'center', opacity: 0.7,
};
const errorStyle: React.CSSProperties = {
  margin: 'auto', padding: 40, textAlign: 'center', color: 'var(--warn, #f14c4c)',
};
