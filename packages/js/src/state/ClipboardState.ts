import type { IActiveCell, ISelectionRange, IColumnDef, ICellValueChangedEvent } from '@alaarab/ogrid-core';
import { normalizeSelectionRange, getCellValue } from '@alaarab/ogrid-core';
import { parseValue } from '@alaarab/ogrid-core';
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
    const { items, visibleCols } = this.params;
    const rows: string[] = [];
    for (let r = norm.startRow; r <= norm.endRow; r++) {
      const cells: string[] = [];
      for (let c = norm.startCol; c <= norm.endCol; c++) {
        if (r >= items.length || c >= visibleCols.length) break;
        const item = items[r];
        const col = visibleCols[c];
        const raw = getCellValue(item, col as unknown as Parameters<typeof getCellValue>[1]);
        const val = col.valueFormatter ? col.valueFormatter(raw, item) : raw;
        cells.push(
          val != null && val !== '' ? String(val).replace(/\t/g, ' ').replace(/\n/g, ' ') : ''
        );
      }
      rows.push(cells.join('\t'));
    }
    const tsv = rows.join('\r\n');
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
    const { items, visibleCols } = this.params;
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    for (let r = 0; r < lines.length; r++) {
      const cells = lines[r].split('\t');
      for (let c = 0; c < cells.length; c++) {
        const targetRow = anchorRow + r;
        const targetCol = anchorCol + c;
        if (targetRow >= items.length || targetCol >= visibleCols.length) continue;
        const item = items[targetRow];
        const col = visibleCols[targetCol];
        const colEditable =
          col.editable === true ||
          (typeof col.editable === 'function' && col.editable(item));
        if (!colEditable) continue;
        const rawValue = cells[c] ?? '';
        const oldValue = getCellValue(item, col as unknown as Parameters<typeof getCellValue>[1]);
        const result = parseValue(rawValue, oldValue, item, col);
        if (!result.valid) continue;
        onCellValueChanged({
          item,
          columnId: col.columnId,
          oldValue,
          newValue: result.value,
          rowIndex: targetRow,
        });
      }
    }
    if (this._cutRange) {
      const cut = this._cutRange;
      for (let r = cut.startRow; r <= cut.endRow; r++) {
        for (let c = cut.startCol; c <= cut.endCol; c++) {
          if (r >= items.length || c >= visibleCols.length) continue;
          const item = items[r];
          const col = visibleCols[c];
          const colEditable =
            col.editable === true ||
            (typeof col.editable === 'function' && col.editable(item));
          if (!colEditable) continue;
          const oldValue = getCellValue(item, col as unknown as Parameters<typeof getCellValue>[1]);
          const result = parseValue('', oldValue, item, col);
          if (!result.valid) continue;
          onCellValueChanged({
            item,
            columnId: col.columnId,
            oldValue,
            newValue: result.value,
            rowIndex: r,
          });
        }
      }
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
