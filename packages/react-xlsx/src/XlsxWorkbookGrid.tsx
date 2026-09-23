// Multi-sheet wrapper. Accepts either a Blob (parsed lazily on mount)
// or a pre-parsed WorkBook. Renders a sheet-tab strip across the top
// and the active sheet's grid below.

import { useEffect, useMemo, useRef, useState } from 'react';
import type ExcelJS from 'exceljs';
import { XlsxGrid, type XlsxGridProps } from './XlsxGrid';
import { workbookFromBlob, type SheetToGridDataOptions } from './sheetMapper';

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
};

let workbookGridInstanceCounter = 0;

export function XlsxWorkbookGrid(props: XlsxWorkbookGridProps) {
  const { height = '100%', initialSheet, density, onSheetChange, headerRow, limits } = props;
  const sourceBlob = 'blob' in props ? props.blob : null;
  const sourceWorkbook = 'workbook' in props ? props.workbook : null;
  const [workbook, setWorkbook] = useState<ExcelJS.Workbook | null>(sourceWorkbook);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sourceWorkbook) {
      setWorkbook(sourceWorkbook);
      return;
    }
    if (!sourceBlob) return;
    let cancelled = false;
    setError(null);
    // Drop the previous file's workbook so it isn't shown (and editable)
    // while the new one parses.
    setWorkbook(null);
    workbookFromBlob(sourceBlob)
      .then((wb) => { if (!cancelled) setWorkbook(wb); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
    return () => { cancelled = true; };
  }, [sourceBlob, sourceWorkbook]);

  const sheetNames = useMemo(
    () => workbook?.worksheets.map((w) => w.name) ?? [],
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
  if (!workbook || !active) {
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
                style={isActive ? tabActiveStyle : tabStyle}
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
        <XlsxGrid workbook={workbook} sheetName={active} density={density} headerRow={headerRow} limits={limits} />
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
  border: '1px solid var(--border, #1f2a3a)',
  borderBottom: 'none',
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
  border: '1px solid var(--accent, #3cb87a)',
  borderBottom: 'none',
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
