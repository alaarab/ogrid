import type { IActiveCell, ISelectionRange, IColumnDef, ICellValueChangedEvent } from '@alaarab/ogrid-core';
import { normalizeSelectionRange, getCellValue, parseValue } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

interface FillHandleEvents extends Record<string, unknown> {
  fillRangeChange: { fillRange: ISelectionRange | null };
}

export interface FillHandleParams<T> {
  items: T[];
  visibleCols: IColumnDef<T>[];
  editable?: boolean;
  onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;
  colOffset: number;
  beginBatch?: () => void;
  endBatch?: () => void;
}

/**
 * Manages Excel-style fill handle drag-to-fill for cell ranges (vanilla JS).
 * Mirrors the React `useFillHandle` hook as a class-based state.
 */
export class FillHandleState<T> {
  private emitter = new EventEmitter<FillHandleEvents>();
  private params: FillHandleParams<T>;
  private getSelectionRange: () => ISelectionRange | null;
  private setSelectionRange: (range: ISelectionRange | null) => void;
  private setActiveCell: (cell: IActiveCell | null) => void;
  private wrapperRef: HTMLElement | null = null;

  private _isFillDragging = false;
  private fillDragStart: { startRow: number; startCol: number } | null = null;
  private fillDragEnd: { endRow: number; endCol: number } = { endRow: 0, endCol: 0 };
  private rafHandle = 0;
  private liveFillRange: ISelectionRange | null = null;
  private lastMousePos: { cx: number; cy: number } | null = null;

  private onMoveBound: (e: MouseEvent) => void;
  private onUpBound: (e: MouseEvent) => void;

  constructor(
    params: FillHandleParams<T>,
    getSelectionRange: () => ISelectionRange | null,
    setSelectionRange: (range: ISelectionRange | null) => void,
    setActiveCell: (cell: IActiveCell | null) => void
  ) {
    this.params = params;
    this.getSelectionRange = getSelectionRange;
    this.setSelectionRange = setSelectionRange;
    this.setActiveCell = setActiveCell;
    this.onMoveBound = this.onMouseMove.bind(this);
    this.onUpBound = this.onMouseUp.bind(this);
  }

  get isFillDragging(): boolean {
    return this._isFillDragging;
  }

  get fillRange(): ISelectionRange | null {
    return this.liveFillRange;
  }

  setWrapperRef(ref: HTMLElement | null): void {
    this.wrapperRef = ref;
  }

  updateParams(params: FillHandleParams<T>): void {
    this.params = params;
  }

  /** Called when the fill handle square is mousedown'd. */
  startFillDrag(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();

    const range = this.getSelectionRange();
    if (!range) return;
    if (this.params.editable === false || !this.params.onCellValueChanged) return;

    this._isFillDragging = true;
    this.fillDragStart = { startRow: range.startRow, startCol: range.startCol };
    this.fillDragEnd = { endRow: range.startRow, endCol: range.startCol };
    this.liveFillRange = null;

    window.addEventListener('mousemove', this.onMoveBound, true);
    window.addEventListener('mouseup', this.onUpBound, true);
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this._isFillDragging || !this.fillDragStart) return;

    this.lastMousePos = { cx: e.clientX, cy: e.clientY };

    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);

    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = 0;
      if (!this.lastMousePos) return;
      const newRange = this.resolveRange(this.lastMousePos.cx, this.lastMousePos.cy);
      if (!newRange) return;

      // Skip if unchanged
      const prev = this.liveFillRange;
      if (
        prev &&
        prev.startRow === newRange.startRow &&
        prev.startCol === newRange.startCol &&
        prev.endRow === newRange.endRow &&
        prev.endCol === newRange.endCol
      ) {
        return;
      }

      this.liveFillRange = newRange;
      this.fillDragEnd = { endRow: newRange.endRow, endCol: newRange.endCol };
      this.applyDragAttrs(newRange);
    });
  }

  private onMouseUp(): void {
    if (!this._isFillDragging || !this.fillDragStart) return;

    window.removeEventListener('mousemove', this.onMoveBound, true);
    window.removeEventListener('mouseup', this.onUpBound, true);

    if (this.rafHandle) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = 0;
    }

    // Flush: resolve final position
    if (this.lastMousePos) {
      const flushed = this.resolveRange(this.lastMousePos.cx, this.lastMousePos.cy);
      if (flushed) {
        this.liveFillRange = flushed;
        this.fillDragEnd = { endRow: flushed.endRow, endCol: flushed.endCol };
      }
    }

    this.clearDragAttrs();

    const start = this.fillDragStart;
    const end = this.fillDragEnd;
    const norm = normalizeSelectionRange({
      startRow: start.startRow,
      startCol: start.startCol,
      endRow: end.endRow,
      endCol: end.endCol,
    });

    // Commit range
    this.setSelectionRange(norm);
    this.setActiveCell({ rowIndex: end.endRow, columnIndex: end.endCol + this.params.colOffset });

    // Apply fill values
    this.applyFillValues(norm, start);

    this._isFillDragging = false;
    this.fillDragStart = null;
    this.liveFillRange = null;
    this.lastMousePos = null;
    this.emitter.emit('fillRangeChange', { fillRange: null });
  }

  private applyFillValues(
    norm: ISelectionRange,
    start: { startRow: number; startCol: number }
  ): void {
    const { items, visibleCols, onCellValueChanged, beginBatch, endBatch } = this.params;
    if (!onCellValueChanged) return;

    const startItem = items[norm.startRow];
    const startColDef = visibleCols[norm.startCol];
    if (!startItem || !startColDef) return;

    const startValue = getCellValue(startItem as T, startColDef as unknown as Parameters<typeof getCellValue>[1]);
    beginBatch?.();
    for (let row = norm.startRow; row <= norm.endRow; row++) {
      for (let col = norm.startCol; col <= norm.endCol; col++) {
        if (row === start.startRow && col === start.startCol) continue;
        if (row >= items.length || col >= visibleCols.length) continue;
        const item = items[row];
        const colDef = visibleCols[col];
        const colEditable =
          colDef.editable === true ||
          (typeof colDef.editable === 'function' && colDef.editable(item));
        if (!colEditable) continue;
        const oldValue = getCellValue(item, colDef as unknown as Parameters<typeof getCellValue>[1]);
        const result = parseValue(startValue, oldValue, item, colDef);
        if (!result.valid) continue;
        onCellValueChanged({
          item,
          columnId: colDef.columnId,
          oldValue,
          newValue: result.value,
          rowIndex: row,
        });
      }
    }
    endBatch?.();
  }

  private resolveRange(cx: number, cy: number): ISelectionRange | null {
    if (!this.fillDragStart || !this.wrapperRef) return null;
    const target = document.elementFromPoint(cx, cy) as HTMLElement | null;
    const cell = target?.closest?.('[data-row-index][data-col-index]');
    if (!cell || !this.wrapperRef.contains(cell)) return null;
    const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
    const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
    if (Number.isNaN(r) || Number.isNaN(c) || c < this.params.colOffset) return null;
    const dataCol = c - this.params.colOffset;
    return normalizeSelectionRange({
      startRow: this.fillDragStart.startRow,
      startCol: this.fillDragStart.startCol,
      endRow: r,
      endCol: dataCol,
    });
  }

  private applyDragAttrs(range: ISelectionRange): void {
    const wrapper = this.wrapperRef;
    if (!wrapper) return;
    const colOff = this.params.colOffset;
    const minR = Math.min(range.startRow, range.endRow);
    const maxR = Math.max(range.startRow, range.endRow);
    const minC = Math.min(range.startCol, range.endCol);
    const maxC = Math.max(range.startCol, range.endCol);
    const cells = wrapper.querySelectorAll('[data-row-index][data-col-index]');
    for (let i = 0; i < cells.length; i++) {
      const el = cells[i];
      const r = parseInt(el.getAttribute('data-row-index')!, 10);
      const c = parseInt(el.getAttribute('data-col-index')!, 10) - colOff;
      const inRange = r >= minR && r <= maxR && c >= minC && c <= maxC;
      if (inRange) {
        if (!el.hasAttribute('data-drag-range')) el.setAttribute('data-drag-range', '');
      } else {
        if (el.hasAttribute('data-drag-range')) el.removeAttribute('data-drag-range');
      }
    }
  }

  private clearDragAttrs(): void {
    const wrapper = this.wrapperRef;
    if (!wrapper) return;
    const marked = wrapper.querySelectorAll('[data-drag-range]');
    for (let i = 0; i < marked.length; i++) marked[i].removeAttribute('data-drag-range');
  }

  onFillRangeChange(handler: (data: FillHandleEvents['fillRangeChange']) => void): () => void {
    this.emitter.on('fillRangeChange', handler);
    return () => this.emitter.off('fillRangeChange', handler);
  }

  destroy(): void {
    if (this._isFillDragging) {
      window.removeEventListener('mousemove', this.onMoveBound, true);
      window.removeEventListener('mouseup', this.onUpBound, true);
    }
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    this.emitter.removeAllListeners();
  }
}
