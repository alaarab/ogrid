import { DEFAULT_MIN_COLUMN_WIDTH, CELL_PADDING, CHECKBOX_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

interface LayoutChangeEvent {
  type: 'containerResize' | 'columnOverride';
}

export class TableLayoutState {
  private emitter = new EventEmitter<{ layoutChange: LayoutChangeEvent }>();
  private _containerWidth = 0;
  private _columnSizingOverrides: Record<string, number> = {};
  private _ro: ResizeObserver | null = null;

  /** Start observing a container element for resize. */
  observeContainer(el: HTMLElement): void {
    this.disconnectObserver();
    // ResizeObserver may not be available in jsdom test environments
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const rect = entry.contentRect;
          this._containerWidth = rect.width;
          this.emitter.emit('layoutChange', { type: 'containerResize' });
        }
      });
      this._ro.observe(el);
    }
    // Measure initial size
    this._containerWidth = el.clientWidth;
  }

  private disconnectObserver(): void {
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
  }

  get containerWidth(): number {
    return this._containerWidth;
  }

  get columnSizingOverrides(): Record<string, number> {
    return this._columnSizingOverrides;
  }

  /** Set a column width override (from resize drag). */
  setColumnOverride(columnId: string, widthPx: number): void {
    this._columnSizingOverrides[columnId] = widthPx;
    this.emitter.emit('layoutChange', { type: 'columnOverride' });
  }

  /** Compute minimum table width from visible columns. */
  computeMinTableWidth(visibleColumnCount: number, hasCheckboxColumn: boolean): number {
    const checkboxWidth = hasCheckboxColumn ? CHECKBOX_COLUMN_WIDTH : 0;
    return checkboxWidth + visibleColumnCount * (DEFAULT_MIN_COLUMN_WIDTH + CELL_PADDING);
  }

  /** Compute desired table width respecting overrides. */
  computeDesiredTableWidth(
    visibleColumns: { columnId: string; minWidth?: number; width?: number }[],
    hasCheckboxColumn: boolean
  ): number {
    const checkboxWidth = hasCheckboxColumn ? CHECKBOX_COLUMN_WIDTH : 0;
    let total = checkboxWidth;
    for (const col of visibleColumns) {
      const override = this._columnSizingOverrides[col.columnId];
      if (override) {
        total += override + CELL_PADDING;
      } else {
        total += (col.width ?? col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH) + CELL_PADDING;
      }
    }
    return total;
  }

  /** Get all column widths (overrides only — non-overridden columns use CSS defaults). */
  getAllColumnWidths(): Record<string, number> {
    return { ...this._columnSizingOverrides };
  }

  /** Remove overrides for columns that no longer exist. */
  cleanupOverrides(validColumnIds: Set<string>): void {
    const next: Record<string, number> = {};
    let changed = false;
    for (const [key, value] of Object.entries(this._columnSizingOverrides)) {
      if (validColumnIds.has(key)) {
        next[key] = value;
      } else {
        changed = true;
      }
    }
    if (changed) {
      this._columnSizingOverrides = next;
      this.emitter.emit('layoutChange', { type: 'columnOverride' });
    }
  }

  /** Apply initial column widths from options. */
  applyInitialWidths(initialWidths: Record<string, number>): void {
    this._columnSizingOverrides = { ...initialWidths };
  }

  onLayoutChange(handler: (event: LayoutChangeEvent) => void): () => void {
    this.emitter.on('layoutChange', handler);
    return () => this.emitter.off('layoutChange', handler);
  }

  destroy(): void {
    this.disconnectObserver();
    this.emitter.removeAllListeners();
  }
}
