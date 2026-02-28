import type { IActiveCell, ISelectionRange, IColumnDef, ICellValueChangedEvent, IFillFormulaOptions } from '@alaarab/ogrid-core';
import { normalizeSelectionRange, applyFillValues } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';
import { getCellCoordinates } from '../utils/getCellCoordinates';

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
  /** Optional formula-aware fill options. When provided, cells with formulas adjust references during fill. */
  formulaOptions?: IFillFormulaOptions<T>;
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
  private cachedCells: NodeListOf<Element> | null = null;

  private onMoveBound: (e: PointerEvent) => void;
  private onUpBound: (e: PointerEvent) => void;

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

  /** Fill the current selection down from the top row (keyboard Ctrl+D). No-op if no selection or editable=false. */
  fillDown(): void {
    const range = this.getSelectionRange();
    if (!range || this.params.editable === false || !this.params.onCellValueChanged) return;
    const norm = normalizeSelectionRange(range);
    this.applyFillValuesFromCore(norm, { startRow: norm.startRow, startCol: norm.startCol });
  }

  /** Called when the fill handle square is pointerdown'd. */
  startFillDrag(e: PointerEvent): void {
    e.preventDefault();
    e.stopPropagation();

    const range = this.getSelectionRange();
    if (!range) return;
    if (this.params.editable === false || !this.params.onCellValueChanged) return;

    this._isFillDragging = true;
    this.fillDragStart = { startRow: range.startRow, startCol: range.startCol };
    this.fillDragEnd = { endRow: range.startRow, endCol: range.startCol };
    this.liveFillRange = null;
    // Cache querySelectorAll result once on drag start
    this.cachedCells = this.wrapperRef ? this.wrapperRef.querySelectorAll('[data-row-index][data-col-index]') : null;

    window.addEventListener('pointermove', this.onMoveBound, { capture: true, passive: true });
    window.addEventListener('pointerup', this.onUpBound, { capture: true, passive: true });
  }

  private onMouseMove(e: PointerEvent): void {
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

    window.removeEventListener('pointermove', this.onMoveBound, true);
    window.removeEventListener('pointerup', this.onUpBound, true);

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
    this.setActiveCell({ rowIndex: start.startRow, columnIndex: start.startCol + this.params.colOffset });

    // Apply fill values
    this.applyFillValuesFromCore(norm, start);

    this._isFillDragging = false;
    this.fillDragStart = null;
    this.liveFillRange = null;
    this.lastMousePos = null;
    this.emitter.emit('fillRangeChange', { fillRange: null });
  }

  private applyFillValuesFromCore(
    norm: ISelectionRange,
    start: { startRow: number; startCol: number }
  ): void {
    const { items, visibleCols, onCellValueChanged, beginBatch, endBatch, formulaOptions } = this.params;
    if (!onCellValueChanged) return;

    const fillEvents = applyFillValues(norm, start.startRow, start.startCol, items, visibleCols, formulaOptions);
    if (fillEvents.length > 0) {
      beginBatch?.();
      for (const evt of fillEvents) onCellValueChanged(evt);
      endBatch?.();
    }
  }

  private resolveRange(cx: number, cy: number): ISelectionRange | null {
    if (!this.fillDragStart || !this.wrapperRef) return null;
    const target = document.elementFromPoint(cx, cy) as HTMLElement | null;
    const cell = target?.closest?.('[data-row-index][data-col-index]');
    if (!cell || !this.wrapperRef.contains(cell)) return null;
    const coords = getCellCoordinates(cell);
    if (!coords || coords.colIndex < this.params.colOffset) return null;
    const r = coords.rowIndex;
    const dataCol = coords.colIndex - this.params.colOffset;
    return normalizeSelectionRange({
      startRow: this.fillDragStart.startRow,
      startCol: this.fillDragStart.startCol,
      endRow: r,
      endCol: dataCol,
    });
  }

  private applyDragAttrs(range: ISelectionRange): void {
    const cells = this.cachedCells;
    if (!cells) return;
    const colOff = this.params.colOffset;
    const minR = Math.min(range.startRow, range.endRow);
    const maxR = Math.max(range.startRow, range.endRow);
    const minC = Math.min(range.startCol, range.endCol);
    const maxC = Math.max(range.startCol, range.endCol);
    for (let i = 0; i < cells.length; i++) {
      const el = cells[i];
      const coords = getCellCoordinates(el);
      if (!coords) continue;
      const r = coords.rowIndex;
      const c = coords.colIndex - colOff;
      const inRange = r >= minR && r <= maxR && c >= minC && c <= maxC;
      if (inRange) {
        if (!el.hasAttribute('data-drag-range')) el.setAttribute('data-drag-range', '');
      } else {
        if (el.hasAttribute('data-drag-range')) el.removeAttribute('data-drag-range');
      }
    }
  }

  private clearDragAttrs(): void {
    const cells = this.cachedCells;
    if (cells) {
      for (let i = 0; i < cells.length; i++) cells[i].removeAttribute('data-drag-range');
    }
    this.cachedCells = null;
  }

  onFillRangeChange(handler: (data: FillHandleEvents['fillRangeChange']) => void): () => void {
    this.emitter.on('fillRangeChange', handler);
    return () => this.emitter.off('fillRangeChange', handler);
  }

  destroy(): void {
    if (this._isFillDragging) {
      window.removeEventListener('pointermove', this.onMoveBound, true);
      window.removeEventListener('pointerup', this.onUpBound, true);
      this.clearDragAttrs();
      this._isFillDragging = false;
      this.fillDragStart = null;
      this.liveFillRange = null;
      this.lastMousePos = null;
    }
    if (this.rafHandle) { cancelAnimationFrame(this.rafHandle); this.rafHandle = 0; }
    this.emitter.removeAllListeners();
  }
}
