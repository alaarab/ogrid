import type { IActiveCell, ISelectionRange, IColumnDef, ICellValueChangedEvent } from '@alaarab/ogrid-core';
import { normalizeSelectionRange, formatSelectionAsTsv, parseTsvClipboard, applyPastedValues, applyCutClear } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

interface ClipboardStateEvents extends Record<string, unknown> {
  rangesChange: { copyRange: ISelectionRange | null; cutRange: ISelectionRange | null };
}

export interface ClipboardParams<T> {
  items: T[];
  visibleCols: IColumnDef<T>[];
  colOffset: number;
  editable?: boolean;
  onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;
  /** When true, enables formula-aware copy/paste. */
  formulas?: boolean;
  /** Flat (unfiltered) column list used to map visible col to flat col index. */
  flatColumns?: IColumnDef<T>[];
  /** Returns the formula string for a flat column + row, or undefined if none. */
  getFormula?: (col: number, row: number) => string | undefined;
  /** Returns true if a flat column + row has a formula. */
  hasFormula?: (col: number, row: number) => boolean;
  /** Sets or clears a formula for a flat column + row. */
  setFormula?: (col: number, row: number, formula: string | null) => void;
}

export class ClipboardState<T> {
  private emitter = new EventEmitter<ClipboardStateEvents>();
  private params: ClipboardParams<T>;
  private getActiveCell: () => IActiveCell | null;
  private getSelectionRange: () => ISelectionRange | null;
  private _cutRange: ISelectionRange | null = null;
  private _copyRange: ISelectionRange | null = null;
  private internalClipboard: string | null = null;

  constructor(
    params: ClipboardParams<T>,
    getActiveCell: () => IActiveCell | null,
    getSelectionRange: () => ISelectionRange | null
  ) {
    this.params = params;
    this.getActiveCell = getActiveCell;
    this.getSelectionRange = getSelectionRange;
  }

  updateParams(params: ClipboardParams<T>): void {
    this.params = params;
  }

  get cutRange(): ISelectionRange | null {
    return this._cutRange;
  }

  get copyRange(): ISelectionRange | null {
    return this._copyRange;
  }

  private getEffectiveRange(): ISelectionRange | null {
    const sel = this.getSelectionRange();
    const ac = this.getActiveCell();
    return sel ?? (ac != null
      ? { startRow: ac.rowIndex, startCol: ac.columnIndex - this.params.colOffset, endRow: ac.rowIndex, endCol: ac.columnIndex - this.params.colOffset }
      : null);
  }

  handleCopy(): void {
    const range = this.getEffectiveRange();
    if (range == null) return;
    const norm = normalizeSelectionRange(range);
    const { items, visibleCols, formulas, flatColumns, getFormula, hasFormula, colOffset } = this.params;
    const formulaOptions = formulas && flatColumns
      ? { colOffset, flatColumns, getFormula, hasFormula }
      : undefined;
    const tsv = formatSelectionAsTsv(items, visibleCols as unknown as Parameters<typeof formatSelectionAsTsv>[1], norm, formulaOptions as Parameters<typeof formatSelectionAsTsv>[3]);
    this.internalClipboard = tsv;
    this._copyRange = norm;
    this._cutRange = null;
    this.emitter.emit('rangesChange', { copyRange: this._copyRange, cutRange: null });
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(tsv).catch(() => {});
    }
  }

  handleCut(): void {
    if (this.params.editable === false) return;
    const range = this.getEffectiveRange();
    if (range == null) return;
    const norm = normalizeSelectionRange(range);
    this._cutRange = norm;
    this._copyRange = null;
    this.handleCopy();
    // handleCopy sets copyRange — override it back since this is a cut
    this._copyRange = null;
    this._cutRange = norm;
    this.emitter.emit('rangesChange', { copyRange: null, cutRange: this._cutRange });
  }

  async handlePaste(): Promise<void> {
    if (this.params.editable === false) return;
    const { onCellValueChanged } = this.params;
    let text: string;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        text = await navigator.clipboard.readText();
      } else {
        text = '';
      }
    } catch {
      text = '';
    }
    if (!text.trim() && this.internalClipboard != null) {
      text = this.internalClipboard;
    }
    if (!text.trim()) return;
    if (onCellValueChanged == null) return;
    const norm = this.getEffectiveRange();
    const anchorRow = norm ? norm.startRow : 0;
    const anchorCol = norm ? norm.startCol : 0;
    const { items, visibleCols, formulas, flatColumns, setFormula, colOffset } = this.params;
    const formulaOptions = formulas && flatColumns
      ? { colOffset, flatColumns, setFormula }
      : undefined;
    const parsedRows = parseTsvClipboard(text);
    const pasteEvents = applyPastedValues(parsedRows, anchorRow, anchorCol, items, visibleCols, formulaOptions);
    for (const evt of pasteEvents) onCellValueChanged(evt);
    if (this._cutRange) {
      const cutEvents = applyCutClear(this._cutRange, items, visibleCols);
      for (const evt of cutEvents) onCellValueChanged(evt);
      this._cutRange = null;
    }
    this._copyRange = null;
    this.emitter.emit('rangesChange', { copyRange: null, cutRange: null });
  }

  clearClipboardRanges(): void {
    this._copyRange = null;
    this._cutRange = null;
    this.emitter.emit('rangesChange', { copyRange: null, cutRange: null });
  }

  onRangesChange(handler: (data: ClipboardStateEvents['rangesChange']) => void): () => void {
    this.emitter.on('rangesChange', handler);
    return () => this.emitter.off('rangesChange', handler);
  }

  destroy(): void {
    this.emitter.removeAllListeners();
  }
}
