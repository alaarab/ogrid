// Multi-sheet wrapper. Accepts either a Blob (parsed lazily on mount)
// or a pre-parsed WorkBook. Renders a sheet-tab strip across the top
// and the active sheet's grid below.

import { useEffect, useMemo, useState } from 'react';
import type ExcelJS from 'exceljs';
import { XlsxGrid } from './XlsxGrid';
import { workbookFromBlob } from './sheetMapper';

type Source = { blob: Blob } | { workbook: ExcelJS.Workbook };

export type XlsxWorkbookGridProps = Source & {
  /** CSS height of the whole component. Defaults to '100%'. */
  height?: number | string;
  /** Initial sheet to display. Defaults to the first sheet. */
  initialSheet?: string;
  density?: 'compact' | 'normal' | 'comfortable';
  /** Called when the user switches sheets. */
  onSheetChange?: (sheetName: string) => void;
};

export function XlsxWorkbookGrid(props: XlsxWorkbookGridProps) {
  const { height = '100%', initialSheet, density, onSheetChange } = props;
  const [workbook, setWorkbook] = useState<ExcelJS.Workbook | null>(
    'workbook' in props ? props.workbook : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ('workbook' in props) {
      setWorkbook(props.workbook);
      return;
    }
    let cancelled = false;
    setError(null);
    workbookFromBlob(props.blob)
      .then((wb) => { if (!cancelled) setWorkbook(wb); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
    return () => { cancelled = true; };
    // 'blob' is a stable reference per mount; props.workbook doesn't apply here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, ['blob' in props ? props.blob : props.workbook]);

  const sheetNames = useMemo(
    () => workbook?.worksheets.map((w) => w.name) ?? [],
    [workbook],
  );
  const [active, setActive] = useState<string | null>(null);

  // Pick the initial sheet once the workbook is in.
  useEffect(() => {
    if (!sheetNames.length) { setActive(null); return; }
    const wanted = initialSheet && sheetNames.includes(initialSheet) ? initialSheet : sheetNames[0];
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
          {sheetNames.map((name) => {
            const isActive = name === active;
            return (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => { setActive(name); onSheetChange?.(name); }}
                style={isActive ? tabActiveStyle : tabStyle}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}
      <div style={gridWrapStyle}>
        <XlsxGrid workbook={workbook} sheetName={active} density={density} />
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
