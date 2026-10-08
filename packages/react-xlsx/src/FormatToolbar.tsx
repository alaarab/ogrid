// Formatting toolbar for XlsxGrid: font toggles, colors, alignment, number
// format, merge/unmerge, undo/redo and export. Every action applies to the
// grid's current selection and lands in the sheet's undo history.

import { useRef, useState } from 'react';
import { cssToArgb, NUMBER_FORMAT_PRESETS, type StyleEdit } from './cellStyles';
import type { XlsxSelection } from './gridAdapter';
import type { XlsxWorkbookDocument } from './xlsxDocument';

export interface FormatToolbarProps {
  document: XlsxWorkbookDocument;
  sheetName: string;
  /** Reads the grid's current selection. */
  getSelection: () => XlsxSelection | null;
  /** Shows an Export button that downloads the workbook under this name. */
  exportFileName?: string;
}

export function FormatToolbar({ document: doc, sheetName, getSelection, exportFileName }: FormatToolbarProps) {
  // The selection is captured when the pointer or focus enters the toolbar,
  // before a color picker or the format menu takes focus from the grid.
  const captured = useRef<XlsxSelection | null>(null);
  const [fill, setFill] = useState('#FFFF00');
  const [fontColor, setFontColor] = useState('#FF0000');
  const [exporting, setExporting] = useState(false);
  const capture = () => {
    const sel = getSelection();
    if (sel) captured.current = sel;
  };
  const selection = () => getSelection() ?? captured.current;
  const style = (edit: StyleEdit | { kind: 'bold' | 'italic' | 'underline' | 'strike' }) => {
    const sel = selection();
    if (sel) doc.applyStyle(sheetName, sel, edit);
  };
  // Buttons keep focus (and the selection highlight) in the grid.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  const button = (label: string, content: React.ReactNode, onClick: () => void, extra?: React.CSSProperties, disabled?: boolean) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={keepFocus}
      onClick={onClick}
      disabled={disabled}
      style={{ ...buttonStyle, ...extra, ...(disabled ? { opacity: 0.4, cursor: 'default' } : {}) }}
    >
      {content}
    </button>
  );

  return (
    <div
      role="toolbar"
      aria-label="Cell formatting"
      style={toolbarStyle}
      onMouseDownCapture={capture}
      onFocusCapture={capture}
    >
      {button('Undo', '↶', () => doc.undo(sheetName), undefined, !doc.canUndo(sheetName))}
      {button('Redo', '↷', () => doc.redo(sheetName), undefined, !doc.canRedo(sheetName))}
      <span style={dividerStyle} aria-hidden />
      {button('Bold', 'B', () => style({ kind: 'bold' }), { fontWeight: 700 })}
      {button('Italic', 'I', () => style({ kind: 'italic' }), { fontStyle: 'italic' })}
      {button('Underline', 'U', () => style({ kind: 'underline' }), { textDecoration: 'underline' })}
      <span style={dividerStyle} aria-hidden />
      {button('Fill color', <span style={{ ...swatchStyle, background: fill }} />, () => style({ kind: 'fill', argb: cssToArgb(fill) }))}
      <input
        type="color"
        aria-label="Choose fill color"
        value={fill.toLowerCase()}
        onChange={(e) => { setFill(e.target.value); style({ kind: 'fill', argb: cssToArgb(e.target.value) }); }}
        style={colorInputStyle}
      />
      {button('No fill', '∅', () => style({ kind: 'fill', argb: null }))}
      {button('Font color', <span style={{ color: fontColor, fontWeight: 700 }}>A</span>, () => style({ kind: 'fontColor', argb: cssToArgb(fontColor) }))}
      <input
        type="color"
        aria-label="Choose font color"
        value={fontColor.toLowerCase()}
        onChange={(e) => { setFontColor(e.target.value); style({ kind: 'fontColor', argb: cssToArgb(e.target.value) }); }}
        style={colorInputStyle}
      />
      <span style={dividerStyle} aria-hidden />
      {button('Align left', '⯇', () => style({ kind: 'horizontal', value: 'left' }))}
      {button('Align center', '≡', () => style({ kind: 'horizontal', value: 'center' }))}
      {button('Align right', '⯈', () => style({ kind: 'horizontal', value: 'right' }))}
      <span style={dividerStyle} aria-hidden />
      <select
        aria-label="Number format"
        defaultValue=""
        onChange={(e) => {
          const preset = NUMBER_FORMAT_PRESETS.find((p) => p.id === e.target.value);
          if (preset) style({ kind: 'numFmt', value: preset.numFmt });
          e.target.value = '';
        }}
        style={selectStyle}
      >
        <option value="" disabled>Number format</option>
        {NUMBER_FORMAT_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <span style={dividerStyle} aria-hidden />
      {button('Merge cells', 'Merge', () => { const s = selection(); if (s) doc.mergeCells(sheetName, s); })}
      {button('Unmerge cells', 'Unmerge', () => { const s = selection(); if (s) doc.unmergeCells(sheetName, s); })}
      {exportFileName && (
        <>
          <span style={{ flex: 1 }} />
          {button('Export .xlsx', exporting ? 'Exporting…' : 'Export .xlsx', () => {
            setExporting(true);
            doc.download(exportFileName).finally(() => setExporting(false));
          }, undefined, exporting)}
        </>
      )}
    </div>
  );
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: '4px 6px',
  flexWrap: 'wrap',
  flex: '0 0 auto',
  borderBottom: '1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12))',
  background: 'var(--ogrid-header-bg, transparent)',
  fontSize: 12,
};
const buttonStyle: React.CSSProperties = {
  minWidth: 26,
  height: 26,
  padding: '0 6px',
  border: '1px solid transparent',
  borderRadius: 4,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const swatchStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 14,
  height: 14,
  borderRadius: 2,
  border: '1px solid rgba(0, 0, 0, 0.3)',
};
const colorInputStyle: React.CSSProperties = { width: 18, height: 22, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' };
const selectStyle: React.CSSProperties = { height: 26, fontFamily: 'inherit', fontSize: 12, color: 'inherit', background: 'transparent' };
const dividerStyle: React.CSSProperties = { width: 1, height: 18, margin: '0 4px', background: 'var(--ogrid-border, rgba(0, 0, 0, 0.12))' };
