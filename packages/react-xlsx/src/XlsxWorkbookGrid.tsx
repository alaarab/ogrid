// Multi-sheet wrapper. Accepts either a Blob (parsed lazily on mount)
// or a pre-parsed WorkBook. Renders a sheet-tab strip across the top
// and the active sheet's grid below.

import { useEffect, useMemo, useRef, useState } from 'react';
import type ExcelJS from 'exceljs';
import { XlsxGrid, type XlsxGridProps } from './XlsxGrid';
import { tabColorOf, workbookFromBlob, type SheetToGridDataOptions } from './sheetMapper';
import { XlsxWorkbookDocument } from './xlsxDocument';

type Source = { blob: Blob } | { workbook: ExcelJS.Workbook };

export type XlsxWorkbookGridProps = Source & {
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
   */
  onDocument?: (document: XlsxWorkbookDocument) => void;
};

let workbookGridInstanceCounter = 0;

export function XlsxWorkbookGrid(props: XlsxWorkbookGridProps) {
  const { height = '100%', initialSheet, density, onSheetChange, headerRow, limits, onTruncated, editable, toolbar, exportFileName, onDocument } = props;
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
    () => (workbook ? new XlsxWorkbookDocument(workbook, { headerRow, maxRows, maxCols, maxCells }) : null),
    [workbook, headerRow, maxRows, maxCols, maxCells],
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
  const [idBase] = useState(() => `ogrid-xlsx-${++workbookGridInstanceCounter}`);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const selectSheet = (name: string, focus = false) => {
    setActive(name);
    onSheetChange?.(name);
    if (focus) tabRefs.current.get(name)?.focus();
  };

  // WAI-ARIA tabs keyboard model: arrows move and activate, Home/End jump.
  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = sheetNames.length - 1;
    const next =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : -1;
    if (next < 0) return;
    e.preventDefault();
    const name = sheetNames[next];
    if (name) selectSheet(name, true);
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
      {sheetNames.length > 1 && (
        <div role="tablist" aria-label="Workbook sheets" style={tabsStyle}>
          {sheetNames.map((name, index) => {
            const isActive = name === active;
            return (
              <button
                key={name}
                ref={(el) => { if (el) tabRefs.current.set(name, el); else tabRefs.current.delete(name); }}
                id={`${idBase}-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`${idBase}-panel`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectSheet(name)}
                onKeyDown={(e) => onTabKeyDown(e, index)}
                style={{
                  ...(isActive ? tabActiveStyle : tabStyle),
                  ...(tabColors.get(name) ? { boxShadow: `inset 0 -3px 0 ${tabColors.get(name)}` } : {}),
                }}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}
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

const tabsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  padding: '6px 8px 0',
  background: 'var(--bg-3, #1b2330)',
  borderBottom: '1px solid var(--border, #1f2a3a)',
  overflowX: 'auto',
  flex: '0 0 auto',
};

const tabBase: React.CSSProperties = {
  borderWidth: '1px 1px 0',
  borderStyle: 'solid',
  borderColor: 'var(--border, #1f2a3a)',
  borderRadius: '4px 4px 0 0',
  padding: '4px 12px',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
};
const tabStyle: React.CSSProperties = {
  ...tabBase,
  background: 'var(--bg-2, #121821)',
  color: 'var(--fg-dim, #8a96a6)',
};
const tabActiveStyle: React.CSSProperties = {
  ...tabBase,
  background: 'var(--bg, #0b1014)',
  color: 'var(--accent, #3cb87a)',
  borderColor: 'var(--accent, #3cb87a)',
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
