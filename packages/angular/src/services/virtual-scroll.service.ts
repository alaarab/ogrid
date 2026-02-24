import { Injectable, signal, computed, DestroyRef, inject } from '@angular/core';
import {
  computeVisibleRange,
  computeTotalHeight,
  getScrollTopForRow,
  validateVirtualScrollConfig,
} from '@alaarab/ogrid-core';
import type { IVisibleRange, IVirtualScrollConfig } from '@alaarab/ogrid-core';

/**
 * Default minimum row count before virtual scrolling activates.
 * Grids with fewer rows than this render all rows without virtualization
 * to avoid scroll offset artifacts on small datasets.
 */
const DEFAULT_PASSTHROUGH_THRESHOLD = 100;

/**
 * Manages virtual scrolling state using Angular signals.
 * Port of React's useVirtualScroll hook.
 *
 * Uses core's pure-TS `computeVisibleRange` and `getScrollTopForRow` utilities.
 * The UI layer (Angular Material / PrimeNG) provides the scrollable container
 * and calls `onScroll()` / sets `containerHeight`.
 */
@Injectable()
export class VirtualScrollService {
  private destroyRef = inject(DestroyRef);

  // --- Input signals (set by consuming component) ---
  readonly totalRows = signal<number>(0);
  readonly config = signal<IVirtualScrollConfig>({ rowHeight: 36 });
  readonly containerHeight = signal<number>(0);

  // --- Internal state ---
  readonly scrollTop = signal<number>(0);

  // Scrollable container reference for programmatic scrolling
  private containerEl: HTMLElement | null = null;

  // --- Derived computed signals ---

  readonly rowHeight = computed(() => this.config().rowHeight ?? 36);
  readonly overscan = computed(() => this.config().overscan ?? 5);
  readonly enabled = computed(() => this.config().enabled !== false);
  readonly threshold = computed(() => this.config().threshold ?? DEFAULT_PASSTHROUGH_THRESHOLD);

  /** Whether virtual scrolling is actually active (enabled + enough rows). */
  readonly isActive = computed(() => this.enabled() && this.totalRows() >= this.threshold());

  /** The visible range of rows with spacer offsets. */
  readonly visibleRange = computed<IVisibleRange>(() => {
    if (!this.isActive()) {
      // Passthrough: render all rows
      return {
        startIndex: 0,
        endIndex: Math.max(0, this.totalRows() - 1),
        offsetTop: 0,
        offsetBottom: 0,
      };
    }

    return computeVisibleRange(
      this.scrollTop(),
      this.rowHeight(),
      this.containerHeight(),
      this.totalRows(),
      this.overscan(),
    );
  });

  /** Total scrollable height in pixels. */
  readonly totalHeight = computed(() => computeTotalHeight(this.totalRows(), this.rowHeight()));

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.containerEl = null;
    });
  }

  /**
   * Set the scrollable container element.
   * Used for programmatic scrolling (scrollToRow).
   */
  setContainer(el: HTMLElement | null): void {
    this.containerEl = el;
  }

  /**
   * Call this from the container's scroll event handler.
   */
  onScroll(event: Event): void {
    const target = event.target as HTMLElement;
    this.scrollTop.set(target.scrollTop);
  }

  /**
   * Scroll to a specific row index.
   * @param index - The row index to scroll to.
   * @param align - Where to position the row: 'start' (top), 'center', or 'end' (bottom). Default: 'start'.
   */
  scrollToRow(index: number, align: 'start' | 'center' | 'end' = 'start'): void {
    const container = this.containerEl;
    if (!container) return;

    const targetScrollTop = getScrollTopForRow(
      index,
      this.rowHeight(),
      this.containerHeight(),
      align,
    );

    container.scrollTo({ top: targetScrollTop, behavior: 'auto' });
  }

  /**
   * Update the virtual scroll configuration.
   */
  updateConfig(updates: Partial<IVirtualScrollConfig>): void {
    this.config.update((prev) => {
      const next = { ...prev, ...updates };
      validateVirtualScrollConfig(next);
      return next;
    });
  }
}
