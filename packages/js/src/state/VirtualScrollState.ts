import type { IVirtualScrollConfig, IVisibleRange, IVisibleColumnRange } from '@alaarab/ogrid-core';
import { computeVisibleRange, computeTotalHeight, getScrollTopForRow, computeVisibleColumnRange, validateVirtualScrollConfig } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

interface VirtualScrollEvents extends Record<string, unknown> {
  rangeChanged: { visibleRange: IVisibleRange };
  columnRangeChanged: { columnRange: IVisibleColumnRange | null };
  configChanged: { config: IVirtualScrollConfig };
}

const DEFAULT_ROW_HEIGHT = 36;
const DEFAULT_OVERSCAN = 5;
/**
 * Default minimum row count before virtual scrolling activates.
 * Grids with fewer rows than this render all rows without virtualization
 * to avoid scroll offset artifacts on small datasets.
 */
const DEFAULT_PASSTHROUGH_THRESHOLD = 100;

/**
 * Manages virtual scrolling state for the vanilla JS grid.
 * Follows the EventEmitter + RAF pattern from other state classes.
 */
export class VirtualScrollState {
  private emitter = new EventEmitter<VirtualScrollEvents>();

  private _scrollTop = 0;
  private _config: IVirtualScrollConfig;
  private _containerHeight = 0;
  private _totalRows = 0;
  private rafId = 0;
  private _ro: ResizeObserver | null = null;
  private _resizeRafId = 0;
  private _cachedRange: IVisibleRange = { startIndex: 0, endIndex: -1, offsetTop: 0, offsetBottom: 0 };

  // Column virtualization
  private _scrollLeft = 0;
  private _scrollLeftRafId = 0;
  private _containerWidth = 0;
  private _columnWidths: number[] = [];
  private _cachedColumnRange: IVisibleColumnRange | null = null;
  private _roWidth: ResizeObserver | null = null;
  private _resizeWidthRafId = 0;

  constructor(config?: IVirtualScrollConfig) {
    this._config = config ?? { enabled: false };
    validateVirtualScrollConfig(this._config);
  }

  /** Whether virtual scrolling is active (enabled + meets the row threshold). */
  get enabled(): boolean {
    const threshold = this._config.threshold ?? DEFAULT_PASSTHROUGH_THRESHOLD;
    return this._config.enabled === true && this._totalRows >= threshold;
  }

  get config(): IVirtualScrollConfig {
    return this._config;
  }

  get containerHeight(): number {
    return this._containerHeight;
  }

  get totalRows(): number {
    return this._totalRows;
  }

  get scrollTop(): number {
    return this._scrollTop;
  }

  /** Get the current visible range (computed from scroll position). */
  get visibleRange(): IVisibleRange {
    return this._cachedRange;
  }

  /** Get the total scrollable height for all rows. */
  get totalHeight(): number {
    return computeTotalHeight(this._totalRows, this._config.rowHeight ?? DEFAULT_ROW_HEIGHT);
  }

  /** Whether column virtualization is active. */
  get columnVirtualizationEnabled(): boolean {
    return this._config.columns === true;
  }

  /** Get the current visible column range (null when column virtualization is disabled). */
  get columnRange(): IVisibleColumnRange | null {
    return this._cachedColumnRange;
  }

  /** Set the unpinned column widths for horizontal virtualization. */
  setColumnWidths(widths: number[]): void {
    this._columnWidths = widths;
    this.recomputeColumnRange();
  }

  /** Handle horizontal scroll events. RAF-throttled. */
  handleHorizontalScroll(scrollLeft: number): void {
    if (!this.columnVirtualizationEnabled) return;
    if (this._scrollLeftRafId) cancelAnimationFrame(this._scrollLeftRafId);
    this._scrollLeftRafId = requestAnimationFrame(() => {
      this._scrollLeftRafId = 0;
      this._scrollLeft = scrollLeft;
      this.recomputeColumnRange();
    });
  }

  /** Observe a container element for width changes (column virtualization). */
  observeContainerWidth(el: HTMLElement): void {
    this.disconnectWidthObserver();
    if (typeof ResizeObserver !== 'undefined') {
      this._roWidth = new ResizeObserver((entries) => {
        if (entries.length === 0) return;
        this._containerWidth = entries[0].contentRect.width;
        if (this._resizeWidthRafId) cancelAnimationFrame(this._resizeWidthRafId);
        this._resizeWidthRafId = requestAnimationFrame(() => {
          this._resizeWidthRafId = 0;
          this.recomputeColumnRange();
        });
      });
      this._roWidth.observe(el);
    }
    this._containerWidth = el.clientWidth;
  }

  private disconnectWidthObserver(): void {
    if (this._roWidth) {
      this._roWidth.disconnect();
      this._roWidth = null;
    }
  }

  /** Recompute visible column range and emit if changed. */
  private recomputeColumnRange(): void {
    if (!this.columnVirtualizationEnabled || this._columnWidths.length === 0 || this._containerWidth <= 0) {
      if (this._cachedColumnRange !== null) {
        this._cachedColumnRange = null;
        this.emitter.emit('columnRangeChanged', { columnRange: null });
      }
      return;
    }
    const overscan = this._config.columnOverscan ?? 2;
    const newRange = computeVisibleColumnRange(this._scrollLeft, this._columnWidths, this._containerWidth, overscan);
    const prev = this._cachedColumnRange;
    if (!prev || prev.startIndex !== newRange.startIndex || prev.endIndex !== newRange.endIndex) {
      this._cachedColumnRange = newRange;
      this.emitter.emit('columnRangeChanged', { columnRange: newRange });
    } else {
      this._cachedColumnRange = newRange;
    }
  }

  /** Handle scroll events from the table container. RAF-throttled. */
  handleScroll(scrollTop: number): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);

    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this._scrollTop = scrollTop;
      this.recompute();
    });
  }

  /** Scroll the container to bring a specific row into view. */
  scrollToRow(
    index: number,
    container: HTMLElement,
    align?: 'start' | 'center' | 'end'
  ): void {
    const rowHeight = this._config.rowHeight ?? DEFAULT_ROW_HEIGHT;
    const newScrollTop = getScrollTopForRow(index, rowHeight, this._containerHeight, align);
    container.scrollTop = newScrollTop;
    // Also update internal state immediately (don't wait for scroll event)
    this._scrollTop = newScrollTop;
    this.recompute();
  }

  /** Update the virtual scroll configuration. */
  updateConfig(config: IVirtualScrollConfig): void {
    validateVirtualScrollConfig(config);
    this._config = config;
    this.recompute();
    this.emitter.emit('configChanged', { config });
  }

  /** Update the total number of rows. */
  setTotalRows(count: number): void {
    this._totalRows = count;
    this.recompute();
  }

  /** Observe a container element for height changes via ResizeObserver. */
  observeContainer(el: HTMLElement): void {
    this.disconnectObserver();

    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver((entries) => {
        if (entries.length === 0) return;
        this._containerHeight = entries[0].contentRect.height;
        // RAF-throttle recompute to avoid redundant relayouts during resize animations
        if (this._resizeRafId) cancelAnimationFrame(this._resizeRafId);
        this._resizeRafId = requestAnimationFrame(() => {
          this._resizeRafId = 0;
          this.recompute();
        });
      });
      this._ro.observe(el);
    }
    // Measure initial size
    this._containerHeight = el.clientHeight;
  }

  private disconnectObserver(): void {
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
  }

  /** Recompute visible range and emit if changed. */
  private recompute(): void {
    if (!this.enabled) return;

    const rowHeight = this._config.rowHeight ?? DEFAULT_ROW_HEIGHT;
    const overscan = this._config.overscan ?? DEFAULT_OVERSCAN;
    const newRange = computeVisibleRange(
      this._scrollTop,
      rowHeight,
      this._containerHeight,
      this._totalRows,
      overscan
    );

    // Only emit if range actually changed
    const prev = this._cachedRange;
    if (
      prev.startIndex !== newRange.startIndex ||
      prev.endIndex !== newRange.endIndex
    ) {
      this._cachedRange = newRange;
      this.emitter.emit('rangeChanged', { visibleRange: newRange });
    } else {
      this._cachedRange = newRange;
    }
  }

  onRangeChanged(handler: (data: VirtualScrollEvents['rangeChanged']) => void): () => void {
    this.emitter.on('rangeChanged', handler);
    return () => this.emitter.off('rangeChanged', handler);
  }

  onColumnRangeChanged(handler: (data: VirtualScrollEvents['columnRangeChanged']) => void): () => void {
    this.emitter.on('columnRangeChanged', handler);
    return () => this.emitter.off('columnRangeChanged', handler);
  }

  onConfigChanged(handler: (data: VirtualScrollEvents['configChanged']) => void): () => void {
    this.emitter.on('configChanged', handler);
    return () => this.emitter.off('configChanged', handler);
  }

  destroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this._resizeRafId) cancelAnimationFrame(this._resizeRafId);
    if (this._scrollLeftRafId) cancelAnimationFrame(this._scrollLeftRafId);
    if (this._resizeWidthRafId) cancelAnimationFrame(this._resizeWidthRafId);
    this.disconnectObserver();
    this.disconnectWidthObserver();
    this.emitter.removeAllListeners();
  }
}
