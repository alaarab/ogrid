// Formatting toolbar for XlsxGrid: font toggles, colors, alignment, number
// format, merge/unmerge, undo/redo and export. Every action applies to the
// grid's current selection and lands in the sheet's undo history. Toggles
// and color swatches reflect the active cell's style.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { colorToCss, cssToArgb, NUMBER_FORMAT_PRESETS, themePaletteOf, COMMON_FONTS, type BorderLineStyle, type BorderOptions, type BorderScope, type StyleEdit, type XlsxCellStyle } from './cellStyles';
import { FORMAT_TOOLBAR_CSS } from './formatToolbarStyles';
import type { XlsxSelection } from './gridAdapter';
import { cellKey } from './sheetMapper';
import type { XlsxWorkbookDocument } from './xlsxDocument';

export interface FormatToolbarProps {
  document: XlsxWorkbookDocument;
  sheetName: string;
  /** Reads the grid's current selection. */
  getSelection: () => XlsxSelection | null;
  /** Shows an Export button that downloads the workbook under this name. */
  exportFileName?: string;
}

type Toggle = 'bold' | 'italic' | 'underline' | 'strike';
type Menu = 'fill' | 'fontColor' | 'numFmt' | 'fontFamily' | 'fontSize' | 'borders';

export function FormatToolbar({ document: doc, sheetName, getSelection, exportFileName }: FormatToolbarProps) {
  useSyncExternalStore(doc.subscribe, doc.getVersion, doc.getVersion);
  const rootRef = useRef<HTMLDivElement>(null);
  // The selection is captured whenever it changes and when the pointer or
  // focus enters the toolbar, so a menu that takes focus from the grid still
  // knows what to format.
  // A lazy toolbar can mount after the grid already has a selection. Seed
  // its first paint from that selection, then follow subsequent changes.
  const [live, setLive] = useState<XlsxSelection | null>(getSelection);
  const captured = useRef<XlsxSelection | null>(live);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [compact, setCompact] = useState(false);
  const [exporting, setExporting] = useState(false);
  const palette = useMemo(() => themePaletteOf(doc.workbook), [doc]);

  // Respond to the host's width, including a sidebar or a resized demo.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const resize = () => {
      const width = root.getBoundingClientRect().width;
      if (width > 0) setCompact(width < 900);
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(root);
    return () => observer?.disconnect();
  }, []);

  const capture = () => {
    const sel = getSelection();
    if (sel) captured.current = sel;
    setLive((prev) => (sameSelection(prev, sel) ? prev : sel));
  };
  const captureRef = useRef(capture);
  captureRef.current = capture;

  // Follow the grid's selection: it lives in the DOM (data-active-cell /
  // data-in-range), so watch those attributes next to the toolbar.
  useEffect(() => {
    const root = rootRef.current?.parentElement;
    const refresh = () => captureRef.current();
    refresh();
    const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(refresh);
    if (root) observer?.observe(root, { subtree: true, attributes: true, attributeFilter: ['data-active-cell', 'data-in-range'] });
    globalThis.document?.addEventListener('pointerup', refresh);
    globalThis.document?.addEventListener('keyup', refresh);
    return () => {
      observer?.disconnect();
      globalThis.document?.removeEventListener('pointerup', refresh);
      globalThis.document?.removeEventListener('keyup', refresh);
    };
  }, []);

  const current = live ?? captured.current;
  const selection = () => getSelection() ?? captured.current;
  const noSelection = !current;
  const activeStyle: XlsxCellStyle | undefined = current
    ? doc.sheet(sheetName)?.styles.get(cellKey(current.rowIds[0] as string | number, current.columnIds[0] as string))
    : undefined;
  const font = activeStyle?.font as Record<string, unknown> | undefined;
  const fontName = typeof font?.name === 'string' && font.name ? font.name : undefined;
  const fontSize = typeof font?.size === 'number' ? font.size : undefined;
  const fontChoices = useMemo(() => {
    const names = new Set<string>(COMMON_FONTS);
    for (const ws of doc.workbook.worksheets) {
      ws.eachRow((row) => {
        row.eachCell((cell) => {
          const name = cell.font?.name;
          if (name) names.add(name);
        });
      });
    }
    return Array.from(names);
  }, [doc]);
  const fillColor = fillCss(activeStyle, palette);
  const fontColor = colorToCss(activeStyle?.font?.color as Partial<import('exceljs').Color> | undefined, palette);
  const horizontal = activeStyle?.alignment?.horizontal;
  const numFmt = activeStyle?.numFmt ?? null;
  const preset = NUMBER_FORMAT_PRESETS.find((p) => p.numFmt === numFmt);
  const formatLabel = preset?.label ?? (numFmt ? 'Custom' : 'General');

  const style = (edit: StyleEdit | { kind: Toggle }) => {
    const sel = selection();
    if (sel) doc.applyStyle(sheetName, sel, edit);
  };
  const applyBorder = (opts: BorderOptions) => {
    const sel = selection();
    if (sel) doc.applyBorders(sheetName, sel, opts);
  };

  const iconButton = (label: string, icon: React.ReactNode, onClick: () => void, opts: { pressed?: boolean; disabled?: boolean } = {}) => (
    <button
      type="button"
      className="ogrid-xtb-btn ogrid-xtb-icon"
      aria-label={label}
      title={label}
      aria-pressed={opts.pressed}
      data-xtb-item=""
      onMouseDown={keepFocus}
      onClick={onClick}
      disabled={opts.disabled}
    >
      {icon}
    </button>
  );
  const toggle = (kind: Toggle, label: string, icon: React.ReactNode) =>
    iconButton(label, icon, () => style({ kind }), { pressed: !!font?.[kind], disabled: noSelection });
  const align = (value: 'left' | 'center' | 'right', label: string, icon: React.ReactNode) =>
    iconButton(label, icon, () => style({ kind: 'horizontal', value: horizontal === value ? null : value }), {
      pressed: horizontal === value,
      disabled: noSelection,
    });

  const menuProps = (id: Menu) => ({
    open: menu === id,
    onOpenChange: (open: boolean) => setMenu(open ? id : null),
    disabled: noSelection,
  });
  const borders = <BorderMenu {...menuProps('borders')} onPick={applyBorder} />;
  const merges = (
    <div className="ogrid-xtb-group">
      {iconButton('Merge cells', <MergeIcon />, () => { const s = selection(); if (s) doc.mergeCells(sheetName, s); }, { disabled: noSelection })}
      {iconButton('Unmerge cells', <UnmergeIcon />, () => { const s = selection(); if (s) doc.unmergeCells(sheetName, s); }, { disabled: noSelection })}
    </div>
  );

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: arrow keys move between controls (ARIA toolbar pattern)
    <div
      ref={rootRef}
      role="toolbar"
      aria-label="Cell formatting"
      className="ogrid-xtb"
      onMouseDownCapture={capture}
      onFocusCapture={capture}
      onKeyDown={onToolbarKeyDown}
    >
      <style>{FORMAT_TOOLBAR_CSS}</style>
      <div className="ogrid-xtb-group">
        {iconButton('Undo', <UndoIcon />, () => doc.undo(sheetName), { disabled: !doc.canUndo(sheetName) })}
        {iconButton('Redo', <RedoIcon />, () => doc.redo(sheetName), { disabled: !doc.canRedo(sheetName) })}
      </div>
      <span className="ogrid-xtb-sep" aria-hidden />
      <div className="ogrid-xtb-group">
        <FontFamilyMenu
          {...menuProps('fontFamily')}
          current={fontName}
          fonts={fontChoices}
          onPick={(name) => style({ kind: 'fontFamily', value: name })}
        />
        <FontSizeMenu
          {...menuProps('fontSize')}
          current={fontSize}
          onPick={(size) => style({ kind: 'fontSize', value: size })}
        />
      </div>
      <span className="ogrid-xtb-sep" aria-hidden />
      <div className="ogrid-xtb-group">
        {toggle('bold', 'Bold', <BoldIcon />)}
        {toggle('italic', 'Italic', <ItalicIcon />)}
        {toggle('underline', 'Underline', <UnderlineIcon />)}
        {toggle('strike', 'Strikethrough', <StrikeIcon />)}
      </div>
      <span className="ogrid-xtb-sep" aria-hidden />
      <div className="ogrid-xtb-group">
        <ColorMenu
          {...menuProps('fill')}
          label="Fill color"
          icon={<FillIcon />}
          color={fillColor}
          resetLabel="No fill"
          onPick={(hex) => style({ kind: 'fill', argb: hex ? cssToArgb(hex) : null })}
        />
        <ColorMenu
          {...menuProps('fontColor')}
          label="Font color"
          icon={<FontColorIcon />}
          color={fontColor}
          resetLabel="Automatic"
          onPick={(hex) => style({ kind: 'fontColor', argb: hex ? cssToArgb(hex) : null })}
        />
      </div>
      <span className="ogrid-xtb-sep" aria-hidden />
      <div className="ogrid-xtb-group">
        {align('left', 'Align left', <AlignIcon lines={[[3, 21], [3, 15], [3, 17]]} />)}
        {align('center', 'Align center', <AlignIcon lines={[[3, 21], [7, 17], [5, 19]]} />)}
        {align('right', 'Align right', <AlignIcon lines={[[3, 21], [9, 21], [7, 21]]} />)}
      </div>
      <span className="ogrid-xtb-sep" aria-hidden />
      {!compact && <>{borders}<span className="ogrid-xtb-sep" aria-hidden /></>}
      <NumberFormatMenu
        {...menuProps('numFmt')}
        current={preset?.id}
        currentLabel={formatLabel}
        onPick={(value) => style({ kind: 'numFmt', value })}
      />
      <span className="ogrid-xtb-sep" aria-hidden />
      {compact ? (
        <MoreMenu disabled={noSelection} onOpen={() => setMenu(null)}>{borders}{merges}</MoreMenu>
      ) : merges}
      {exportFileName && (
        <>
          <span className="ogrid-xtb-spacer" />
          <button
            type="button"
            className="ogrid-xtb-btn ogrid-xtb-export"
            aria-label="Export .xlsx"
            title={`Download ${exportFileName}`}
            data-xtb-item=""
            onMouseDown={keepFocus}
            disabled={exporting}
            onClick={() => {
              setExporting(true);
              doc.download(exportFileName).finally(() => setExporting(false));
            }}
          >
            <DownloadIcon />
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </>
      )}
    </div>
  );
}

// ---- Menus --------------------------------------------------------------------

interface MenuBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
}

/** Trigger + anchored popover. Closes on outside pointer, Escape, or a pick. */
function useMenu({ open, onOpenChange }: MenuBaseProps, selector = '[data-xtb-nav]') {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const focusInside = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    const close = () => onOpenChangeRef.current(false);
    const onPointer = (e: PointerEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // A nested picker owns its Escape; leave the More surface open.
      if (document.activeElement?.closest('.ogrid-xtb-pop') !== popRef.current && popRef.current?.contains(document.activeElement)) return;
      e.stopPropagation();
      e.preventDefault();
      close();
      if (focusInside.current) triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    if (focusInside.current) {
      const items = navItems(popRef.current, selector);
      (items.find((el) => el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true') ?? items[0])?.focus();
    }
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, selector]);

  const trigger = {
    ref: triggerRef,
    'aria-expanded': open,
    onMouseDown: (e: React.MouseEvent) => {
      keepFocus(e);
      focusInside.current = false;
    },
    onClick: () => onOpenChange(!open),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        focusInside.current = true;
        onOpenChange(true);
      }
    },
  };
  const pick = (fn: () => void) => {
    fn();
    onOpenChange(false);
    if (focusInside.current) triggerRef.current?.focus();
  };
  const popover = {
    ref: popRef,
    onMouseDown: keepFocus,
    onKeyDown: (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Tab') {
        onOpenChange(false);
        return;
      }
      if (moveFocus(popRef.current, e.key, true, selector)) e.preventDefault();
    },
  };
  return { anchorRef, trigger, popover, pick };
}

/** Keep secondary controls at their normal size in a keyboard-accessible surface. */
function MoreMenu({ children, disabled, onOpen }: { children: React.ReactNode; disabled: boolean; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const { anchorRef, trigger, popover } = useMenu({ open, onOpenChange: (next) => { if (next) onOpen(); setOpen(next); } }, '[data-xtb-item]');
  return (
    <span className="ogrid-xtb-anchor" ref={anchorRef}>
      <button type="button" className="ogrid-xtb-btn" aria-label="More" title="More formatting options" aria-haspopup="dialog" data-xtb-item="" disabled={disabled} {...trigger}>
        More<ChevronIcon />
      </button>
      {open && <div role="dialog" aria-label="More formatting options" className="ogrid-xtb-pop ogrid-xtb-more" {...popover}>{children}</div>}
    </span>
  );
}

/** Office theme colors, a light tint row, and Excel's standard colors. */
const THEME_ROWS: Array<Array<[string, string]>> = [
  [['#FFFFFF', 'White'], ['#000000', 'Black'], ['#E7E6E6', 'Light gray'], ['#44546A', 'Blue gray'], ['#4472C4', 'Blue'], ['#ED7D31', 'Orange'], ['#A5A5A5', 'Gray'], ['#FFC000', 'Gold'], ['#5B9BD5', 'Light blue'], ['#70AD47', 'Green']],
  [['#F2F2F2', 'White, darker 5%'], ['#7F7F7F', 'Black, lighter 50%'], ['#D0CECE', 'Light gray, darker 10%'], ['#D6DCE4', 'Blue gray, lighter 80%'], ['#D9E1F2', 'Blue, lighter 80%'], ['#FCE4D6', 'Orange, lighter 80%'], ['#EDEDED', 'Gray, lighter 80%'], ['#FFF2CC', 'Gold, lighter 80%'], ['#DDEBF7', 'Light blue, lighter 80%'], ['#E2EFDA', 'Green, lighter 80%']],
  [['#D9D9D9', 'White, darker 15%'], ['#595959', 'Black, lighter 35%'], ['#AEAAAA', 'Light gray, darker 25%'], ['#ADB9CA', 'Blue gray, lighter 60%'], ['#B4C6E7', 'Blue, lighter 60%'], ['#F8CBAD', 'Orange, lighter 60%'], ['#DBDBDB', 'Gray, lighter 60%'], ['#FFE699', 'Gold, lighter 60%'], ['#BDD7EE', 'Light blue, lighter 60%'], ['#C6E0B4', 'Green, lighter 60%']],
];
const STANDARD_ROW: Array<[string, string]> = [
  ['#C00000', 'Dark red'], ['#FF0000', 'Red'], ['#FFC000', 'Orange'], ['#FFFF00', 'Yellow'], ['#92D050', 'Light green'],
  ['#00B050', 'Green'], ['#00B0F0', 'Light blue'], ['#0070C0', 'Blue'], ['#002060', 'Dark blue'], ['#7030A0', 'Purple'],
];

interface ColorMenuProps extends MenuBaseProps {
  label: string;
  icon: React.ReactNode;
  /** The active cell's color (#RRGGBB), or undefined for none/automatic. */
  color: string | undefined;
  resetLabel: string;
  onPick: (hex: string | null) => void;
}

function ColorMenu(props: ColorMenuProps) {
  const { label, icon, color, resetLabel, onPick, open, disabled } = props;
  const { anchorRef, trigger, popover, pick } = useMenu(props);
  const customRef = useRef<HTMLInputElement>(null);
  // Native color inputs fire `input` while dragging; apply once on `change`.
  useEffect(() => {
    const input = customRef.current;
    if (!input) return;
    const onChange = () => pick(() => onPick(input.value));
    input.addEventListener('change', onChange);
    return () => input.removeEventListener('change', onChange);
  });
  const swatch = ([hex, name]: [string, string]) => (
    <button
      key={hex + name}
      type="button"
      className="ogrid-xtb-swatch"
      style={{ background: hex }}
      aria-label={name}
      title={`${name} (${hex})`}
      aria-pressed={color?.toUpperCase() === hex}
      data-xtb-nav=""
      onClick={() => pick(() => onPick(hex))}
    />
  );
  return (
    <span className="ogrid-xtb-anchor" ref={anchorRef}>
      <button
        type="button"
        className="ogrid-xtb-btn ogrid-xtb-icon"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        data-xtb-item=""
        disabled={disabled}
        {...trigger}
      >
        <span className="ogrid-xtb-color">
          {icon}
          <span className="ogrid-xtb-bar" style={{ background: color ?? (resetLabel === 'Automatic' ? 'currentColor' : 'transparent') }} />
        </span>
      </button>
      {open && (
        <div role="dialog" aria-label={label} className="ogrid-xtb-pop" {...popover}>
          <button type="button" className="ogrid-xtb-item" data-xtb-nav="" aria-pressed={!color} onClick={() => pick(() => onPick(null))}>
            {resetLabel === 'Automatic' ? <AutoColorIcon /> : <NoFillIcon />}
            {resetLabel}
          </button>
          {THEME_ROWS.map((row) => (
            <div key={row[0]?.[1]} className="ogrid-xtb-grid">
              {row.map(swatch)}
            </div>
          ))}
          <div className="ogrid-xtb-grid ogrid-xtb-std">
            {STANDARD_ROW.map(swatch)}
          </div>
          <label className="ogrid-xtb-item ogrid-xtb-custom">
            <PlusIcon />
            Custom…
            <input ref={customRef} type="color" aria-label={`Custom ${label.toLowerCase()}`} defaultValue={color?.toLowerCase() ?? '#000000'} data-xtb-nav="" />
          </label>
        </div>
      )}
    </span>
  );
}

const FORMAT_HINTS: Record<string, string> = {
  general: '1234.5',
  number: '1,234.50',
  currency: '$1,234.50',
  percent: '12.50%',
  date: '2026-09-26',
};

interface NumberFormatMenuProps extends MenuBaseProps {
  current: string | undefined;
  currentLabel: string;
  onPick: (numFmt: string | null) => void;
}

function NumberFormatMenu(props: NumberFormatMenuProps) {
  const { current, currentLabel, onPick, open, disabled } = props;
  const { anchorRef, trigger, popover, pick } = useMenu(props);
  return (
    <span className="ogrid-xtb-anchor" ref={anchorRef}>
      <button
        type="button"
        className="ogrid-xtb-btn ogrid-xtb-format"
        aria-label="Number format"
        title={`Number format: ${currentLabel}`}
        aria-haspopup="menu"
        data-xtb-item=""
        disabled={disabled}
        {...trigger}
      >
        <span className="ogrid-xtb-123" aria-hidden>123</span>
        <span>{currentLabel}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div role="menu" aria-label="Number format" className="ogrid-xtb-pop" {...popover}>
          {NUMBER_FORMAT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={p.id === current}
              aria-label={p.label}
              className="ogrid-xtb-item"
              data-xtb-nav=""
              tabIndex={-1}
              onClick={() => pick(() => onPick(p.numFmt))}
            >
              <span className="ogrid-xtb-check">{p.id === current && <CheckIcon />}</span>
              {p.label}
              <span className="ogrid-xtb-hint">{FORMAT_HINTS[p.id] ?? p.numFmt}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

interface FontFamilyMenuProps extends MenuBaseProps {
  current: string | undefined;
  fonts: string[];
  onPick: (name: string | null) => void;
}

/** A font-family picker: the common fonts plus every font the workbook uses. */
function FontFamilyMenu(props: FontFamilyMenuProps) {
  const { current, fonts, onPick, open, disabled } = props;
  const { anchorRef, trigger, popover, pick } = useMenu(props);
  const label = current ?? 'Default';
  return (
    <span className="ogrid-xtb-anchor" ref={anchorRef}>
      <button
        type="button"
        className="ogrid-xtb-btn ogrid-xtb-font"
        aria-label="Font"
        title={`Font: ${label}`}
        aria-haspopup="menu"
        data-xtb-item=""
        disabled={disabled}
        {...trigger}
      >
        <span className="ogrid-xtb-font-name">{label}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div role="menu" aria-label="Font family" className="ogrid-xtb-pop ogrid-xtb-font-pop" {...popover}>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!current}
            aria-label="Default font"
            className="ogrid-xtb-item"
            data-xtb-nav=""
            tabIndex={-1}
            onClick={() => pick(() => onPick(null))}
          >
            <span className="ogrid-xtb-check">{!current && <CheckIcon />}</span>
            Default
          </button>
          {fonts.map((name) => (
            <button
              key={name}
              type="button"
              role="menuitemradio"
              aria-checked={name === current}
              aria-label={name}
              className="ogrid-xtb-item"
              data-xtb-nav=""
              tabIndex={-1}
              style={{ fontFamily: `"${name}", var(--ogrid-font, inherit)` }}
              onClick={() => pick(() => onPick(name))}
            >
              <span className="ogrid-xtb-check">{name === current && <CheckIcon />}</span>
              {name}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

/** Sizes offered as one-click picks; the input accepts any 8–72. */
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

interface FontSizeMenuProps extends MenuBaseProps {
  current: number | undefined;
  onPick: (size: number) => void;
}

/** A font-size picker: a number input plus common sizes. */
function FontSizeMenu(props: FontSizeMenuProps) {
  const { current, onPick, open, disabled } = props;
  const { anchorRef, trigger, popover, pick } = useMenu(props);
  const [value, setValue] = useState(String(current ?? 11));
  useEffect(() => { setValue(String(current ?? 11)); }, [current]);
  const commit = () => {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 8 && n <= 72) pick(() => onPick(Math.round(n)));
  };
  return (
    <span className="ogrid-xtb-anchor" ref={anchorRef}>
      <button
        type="button"
        className="ogrid-xtb-btn ogrid-xtb-size"
        aria-label="Font size"
        title={`Font size: ${current ?? 11}`}
        aria-haspopup="menu"
        data-xtb-item=""
        disabled={disabled}
        {...trigger}
      >
        <span className="ogrid-xtb-font-size">{current ?? 11}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div role="menu" aria-label="Font size" className="ogrid-xtb-pop ogrid-xtb-size-pop" {...popover}>
          <div className="ogrid-xtb-size-row">
            <input
              type="number"
              min={8}
              max={72}
              step={1}
              value={value}
              aria-label="Font size value"
              data-xtb-nav=""
              className="ogrid-xtb-size-input"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit(); } }}
            />
            <button type="button" className="ogrid-xtb-size-apply" data-xtb-nav="" onClick={commit}>Apply</button>
          </div>
          <div className="ogrid-xtb-size-list">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                role="menuitemradio"
                aria-checked={size === current}
                aria-label={String(size)}
                className="ogrid-xtb-item"
                data-xtb-nav=""
                tabIndex={-1}
                onClick={() => pick(() => onPick(size))}
              >
                <span className="ogrid-xtb-check">{size === current && <CheckIcon />}</span>
                {size}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

interface BorderMenuProps extends MenuBaseProps {
  onPick: (opts: BorderOptions) => void;
}

const BORDER_LINE_STYLES: BorderLineStyle[] = ['thin', 'medium', 'thick', 'dashed', 'dotted', 'double'];

const BORDER_SCOPES: Array<{ id: BorderScope; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'All borders', icon: <BorderIcon scope="all" /> },
  { id: 'outside', label: 'Outside borders', icon: <BorderIcon scope="outside" /> },
  { id: 'inside', label: 'Inside borders', icon: <BorderIcon scope="inside" /> },
  { id: 'top', label: 'Top border', icon: <BorderIcon scope="top" /> },
  { id: 'bottom', label: 'Bottom border', icon: <BorderIcon scope="bottom" /> },
  { id: 'left', label: 'Left border', icon: <BorderIcon scope="left" /> },
  { id: 'right', label: 'Right border', icon: <BorderIcon scope="right" /> },
  { id: 'none', label: 'No border', icon: <BorderIcon scope="none" /> },
];

/** A borders picker: edge buttons, a line style and a color. */
function BorderMenu(props: BorderMenuProps) {
  const { onPick, open, disabled } = props;
  const { anchorRef, trigger, popover, pick } = useMenu(props);
  const [lineStyle, setLineStyle] = useState<BorderLineStyle>('thin');
  const [color, setColor] = useState('#000000');
  const apply = (scope: BorderScope) => pick(() => onPick({ scope, lineStyle, argb: color ? cssToArgb(color) : null }));
  return (
    <span className="ogrid-xtb-anchor" ref={anchorRef}>
      <button
        type="button"
        className="ogrid-xtb-btn ogrid-xtb-icon"
        aria-label="Borders"
        title="Borders"
        aria-haspopup="dialog"
        data-xtb-item=""
        disabled={disabled}
        {...trigger}
      >
        <BordersIcon />
      </button>
      {open && (
        <div role="dialog" aria-label="Borders" className="ogrid-xtb-pop ogrid-xtb-border-pop" {...popover}>
          <div className="ogrid-xtb-border-grid">
            {BORDER_SCOPES.map((scope) => (
              <button
                key={scope.id}
                type="button"
                className="ogrid-xtb-border-btn"
                aria-label={scope.label}
                title={scope.label}
                data-xtb-nav=""
                onClick={() => apply(scope.id)}
              >
                {scope.icon}
              </button>
            ))}
          </div>
          <label className="ogrid-xtb-item ogrid-xtb-border-field">
            Line style
            <select
              className="ogrid-xtb-select"
              value={lineStyle}
              aria-label="Border line style"
              data-xtb-nav=""
              onChange={(e) => setLineStyle(e.target.value as BorderLineStyle)}
            >
              {BORDER_LINE_STYLES.map((style) => (
                <option key={style} value={style}>{style}</option>
              ))}
            </select>
          </label>
          <label className="ogrid-xtb-item ogrid-xtb-custom ogrid-xtb-border-field">
            Line color
            <input
              type="color"
              value={color}
              aria-label="Border color"
              data-xtb-nav=""
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
        </div>
      )}
    </span>
  );
}

// ---- Helpers -------------------------------------------------------------------

/** Buttons keep focus (and the selection highlight) in the grid. */
function keepFocus(e: React.MouseEvent) {
  if (e.target instanceof Element && e.target.closest('input, select')) return;
  e.preventDefault();
}

function sameSelection(a: XlsxSelection | null, b: XlsxSelection | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.rowIds.join('\u0000') === b.rowIds.join('\u0000') && a.columnIds.join('\u0000') === b.columnIds.join('\u0000');
}

function fillCss(style: XlsxCellStyle | undefined, palette: string[]): string | undefined {
  const fill = style?.fill as { type?: string; pattern?: string; fgColor?: Partial<import('exceljs').Color> } | undefined;
  if (fill?.type !== 'pattern' || fill.pattern === 'none') return undefined;
  return colorToCss(fill.fgColor, palette);
}

function navItems(root: HTMLElement | null, selector = '[data-xtb-nav]'): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((el) => !(el as HTMLButtonElement).disabled);
}

/**
 * Arrow-key focus movement. Left/Right (and Up/Down in a flat list) step
 * through items in order; in a 2-D layout Up/Down jump to the nearest item
 * in the next row. Returns whether the key was handled.
 */
function moveFocus(root: HTMLElement | null, key: string, twoD: boolean, selector?: string): boolean {
  if (document.activeElement?.matches('input, select')) return false;
  const items = navItems(root, selector);
  if (!items.length) return false;
  const active = items.indexOf(document.activeElement as HTMLElement);
  let next: HTMLElement | undefined;
  if (key === 'Home') next = items[0];
  else if (key === 'End') next = items[items.length - 1];
  else if (key === 'ArrowRight' || (!twoD && key === 'ArrowDown')) next = items[(active + 1) % items.length];
  else if (key === 'ArrowLeft' || (!twoD && key === 'ArrowUp')) next = items[(active - 1 + items.length) % items.length];
  else if (key === 'ArrowDown' || key === 'ArrowUp') {
    const from = items[active];
    if (!from) next = items[0];
    else {
      const r = from.getBoundingClientRect();
      const cy = r.top + r.height / 2;
      const cx = r.left + r.width / 2;
      const down = key === 'ArrowDown';
      let best: { el: HTMLElement; dy: number; dx: number } | undefined;
      for (const el of items) {
        const b = el.getBoundingClientRect();
        const dy = (b.top + b.height / 2 - cy) * (down ? 1 : -1);
        if (dy <= 2) continue;
        const dx = Math.abs(b.left + b.width / 2 - cx);
        if (!best || dy < best.dy - 2 || (Math.abs(dy - best.dy) <= 2 && dx < best.dx)) best = { el, dy, dx };
      }
      next = best?.el ?? from;
    }
  } else return false;
  next?.focus();
  return true;
}

/** Toolbar keyboard: Left/Right/Home/End move between controls. */
function onToolbarKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  if (!(e.target as HTMLElement).hasAttribute?.('data-xtb-item')) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
  if (moveFocus(e.currentTarget, e.key, false, '[data-xtb-item]')) e.preventDefault();
}

// ---- Icons (inline SVG, 24-unit grid, stroked with currentColor) ----------------

function Svg({ children, size = 16, strokeWidth = 2 }: { children: React.ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const UndoIcon = () => <Svg><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Svg>;
const RedoIcon = () => <Svg><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></Svg>;
const BoldIcon = () => <Svg strokeWidth={2.6}><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" /><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" /></Svg>;
const ItalicIcon = () => <Svg><path d="M19 4h-9" /><path d="M14 20H5" /><path d="M15 4 9 20" /></Svg>;
const UnderlineIcon = () => <Svg><path d="M6 4v6a6 6 0 0 0 12 0V4" /><path d="M4 20h16" /></Svg>;
const StrikeIcon = () => <Svg><path d="M16 4H9a3 3 0 0 0-2.83 4" /><path d="M14 12a4 4 0 0 1 0 8H6" /><path d="M4 12h16" /></Svg>;
const FillIcon = () => (
  <Svg size={15}>
    <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" />
    <path d="m5 2 5 5" />
    <path d="M2 13h15" />
    <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
  </Svg>
);
const FontColorIcon = () => <Svg size={15} strokeWidth={2.2}><path d="m5 20 7-16 7 16" /><path d="M8 14h8" /></Svg>;
const AlignIcon = ({ lines }: { lines: Array<[number, number]> }) => (
  <Svg>
    {lines.map(([x1, x2], i) => `M${x1} ${6 + i * 6}h${x2 - x1}`).map((d) => <path key={d} d={d} />)}
  </Svg>
);
const MergeIcon = () => (
  <Svg><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 12h3" /><path d="m8.5 10 2 2-2 2" /><path d="M17 12h-3" /><path d="m15.5 10-2 2 2 2" /></Svg>
);
const UnmergeIcon = () => (
  <Svg><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 5v14" /><path d="M10 12H6.5" /><path d="m8 10-2 2 2 2" /><path d="M14 12h3.5" /><path d="m16 10 2 2-2 2" /></Svg>
);
const DownloadIcon = () => <Svg><path d="M12 15V3" /><path d="m7 10 5 5 5-5" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></Svg>;

const BordersIcon = () => (
  <Svg><rect x="3" y="3" width="18" height="18" rx="1.5" /><path d="M9 3v18" /><path d="M15 3v18" /><path d="M3 9h18" /><path d="M3 15h18" /></Svg>
);

/** Preview of the border scope: a bold edge, an inner grid, or a dashed "none". */
function BorderIcon({ scope }: { scope: BorderScope }) {
  const boldEdge = (side: 'top' | 'right' | 'bottom' | 'left') => {
    if (scope !== 'all' && scope !== 'outside' && scope !== side) return null;
    const d = side === 'top' ? 'M4 4h16' : side === 'bottom' ? 'M4 20h16' : side === 'left' ? 'M4 4v16' : 'M20 4v16';
    return <path key={side} d={d} strokeWidth={2.6} />;
  };
  return (
    <Svg size={15}>
      {scope !== 'inside' && (
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="1.5"
          strokeWidth={scope === 'none' ? 1 : 1.4}
          strokeDasharray={scope === 'none' ? '3 2.5' : undefined}
        />
      )}
      {boldEdge('top')}{boldEdge('right')}{boldEdge('bottom')}{boldEdge('left')}
      {(scope === 'all' || scope === 'inside') && <path d="M12 4v16" strokeWidth={1.4} />}
      {(scope === 'all' || scope === 'inside') && <path d="M4 12h16" strokeWidth={1.4} />}
    </Svg>
  );
}
const ChevronIcon = () => <span className="ogrid-xtb-chevron"><Svg size={14}><path d="m6 9 6 6 6-6" /></Svg></span>;
const CheckIcon = () => <Svg size={14} strokeWidth={2.4}><path d="M20 6 9 17l-5-5" /></Svg>;
const PlusIcon = () => <Svg size={14}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>;
const NoFillIcon = () => <Svg size={14}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m4 20 16-16" /></Svg>;
const AutoColorIcon = () => <Svg size={14}><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" /></Svg>;
