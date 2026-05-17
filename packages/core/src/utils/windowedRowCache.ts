/**
 * Windowed row cache for on-demand (lazy) data sources.
 *
 * A windowed `IDataSource` (see `IWindowedDataSource`) serves only the rows the
 * grid currently needs instead of whole pages. This cache sits between the grid
 * and that data source: virtualization asks it for a row index, the cache
 * returns the cached row or a loading placeholder, and missing windows are
 * fetched on demand in the background.
 *
 * Responsibilities:
 *  - Cache fetched rows by absolute index for the current sort/filter state.
 *  - Coalesce overlapping/adjacent requests by rounding to a fixed block size,
 *    and dedupe in-flight blocks so the same window is never fetched twice.
 *  - Return a synchronous loading placeholder for not-yet-loaded rows so the
 *    grid can render immediately and re-render when data arrives.
 *  - Invalidate everything when sort or filters change.
 *
 * Pure TypeScript, no DOM or framework dependency. The grid binds it to React
 * state (or signals/refs) via the `onChange` callback.
 */

import type { IWindowedDataSource, IRowQueryContext } from '../types';

/** A cached row slot: either a loaded row, or a placeholder while it loads. */
export type WindowedRow<T> =
  | { status: 'loaded'; row: T }
  | { status: 'loading' }
  | { status: 'error'; error: unknown };

export interface WindowedRowCacheOptions<T> {
  /** The windowed data source to fetch rows from. */
  dataSource: IWindowedDataSource<T>;
  /**
   * Rows per fetch block. Window requests are rounded out to block boundaries
   * so scrolling reuses in-flight fetches. Default: 200.
   */
  blockSize?: number;
  /**
   * Maximum number of rows to keep cached. When exceeded, the blocks furthest
   * from the most recently requested window are evicted. Default: 5000.
   * Set to 0 to disable eviction (unbounded cache).
   */
  maxCachedRows?: number;
  /**
   * Called whenever cached data changes (a fetch resolved/failed, or the cache
   * was invalidated). The grid should re-read rows and re-render in response.
   */
  onChange?: () => void;
}

/** Round `value` down to the nearest multiple of `block`. */
function floorTo(value: number, block: number): number {
  return Math.floor(value / block) * block;
}

/**
 * A windowed row cache. Construct one per grid; call `setContext` when sort or
 * filters change, `ensureRange` as the visible window moves, and `getRow` to
 * read a row (loaded or placeholder) for rendering.
 */
export class WindowedRowCache<T> {
  private readonly dataSource: IWindowedDataSource<T>;
  private readonly blockSize: number;
  private readonly maxCachedRows: number;
  private readonly onChange?: () => void;

  /** Loaded rows keyed by absolute row index. */
  private readonly rows = new Map<number, T>();
  /** In-flight block start indices -> abort controller for that fetch. */
  private readonly inFlight = new Map<number, AbortController>();
  /** Block start indices that failed their last fetch (eligible for retry). */
  private readonly failedBlocks = new Set<number>();

  /** Current sort/filter context. Fetches are tagged with this generation. */
  private context: IRowQueryContext = { filters: {} };
  /** Bumped on every `setContext` / `invalidate` so stale fetches are dropped. */
  private generation = 0;

  /** Total row count for the current context, or `undefined` until first known. */
  private rowCount: number | undefined;
  /** Center of the most recently requested window — drives LRU-ish eviction. */
  private lastRequestCenter = 0;

  constructor(opts: WindowedRowCacheOptions<T>) {
    this.dataSource = opts.dataSource;
    this.blockSize = Math.max(1, opts.blockSize ?? 200);
    this.maxCachedRows = Math.max(0, opts.maxCachedRows ?? 5000);
    this.onChange = opts.onChange;
  }

  /** Total rows for the current context, or `undefined` if not yet fetched. */
  getRowCount(): number | undefined {
    return this.rowCount;
  }

  /**
   * Read the row at `index`. Returns a `loaded` slot when cached, `error` when
   * the covering block's last fetch failed, otherwise `loading`. Never throws
   * and never triggers a fetch — call `ensureRange` to drive fetching.
   */
  getRow(index: number): WindowedRow<T> {
    const row = this.rows.get(index);
    if (row !== undefined) return { status: 'loaded', row };
    const blockStart = floorTo(index, this.blockSize);
    if (this.failedBlocks.has(blockStart)) {
      return { status: 'error', error: new Error(`Failed to load rows [${blockStart}, ${blockStart + this.blockSize})`) };
    }
    return { status: 'loading' };
  }

  /** True when the row at `index` is loaded and available synchronously. */
  hasRow(index: number): boolean {
    return this.rows.has(index);
  }

  /**
   * Update the sort/filter context. Invalidates all cached rows, cancels
   * in-flight fetches, and re-fetches the row count. Call this (not
   * `invalidate`) when the user sorts or filters.
   */
  setContext(context: IRowQueryContext): void {
    this.context = { sort: context.sort, filters: context.filters };
    this.invalidate();
    void this.refreshRowCount();
  }

  /**
   * Drop all cached rows and cancel in-flight fetches without changing the
   * context. Use after a mutation when the underlying data changed but the
   * sort/filter state did not.
   */
  invalidate(): void {
    this.generation++;
    for (const controller of this.inFlight.values()) controller.abort();
    this.inFlight.clear();
    this.rows.clear();
    this.failedBlocks.clear();
    this.notify();
  }

  /**
   * Ensure rows in `[start, end)` are loaded or loading. Rounds the request out
   * to block boundaries, skips blocks already cached or in flight, and kicks
   * off background fetches for the rest. Safe to call on every scroll frame.
   */
  ensureRange(start: number, end: number): void {
    if (end <= start) return;
    this.lastRequestCenter = Math.floor((start + end) / 2);

    const total = this.rowCount;
    const clampedEnd = total !== undefined ? Math.min(end, total) : end;
    if (clampedEnd <= start) return;

    const firstBlock = floorTo(Math.max(0, start), this.blockSize);
    const lastBlock = floorTo(clampedEnd - 1, this.blockSize);

    for (let blockStart = firstBlock; blockStart <= lastBlock; blockStart += this.blockSize) {
      this.ensureBlock(blockStart);
    }
    this.evictIfNeeded();
  }

  /** Retry a previously failed block that covers `index`. */
  retry(index: number): void {
    const blockStart = floorTo(index, this.blockSize);
    if (this.failedBlocks.has(blockStart)) {
      this.failedBlocks.delete(blockStart);
      this.ensureBlock(blockStart);
    }
  }

  /** Cancel all in-flight fetches and clear the cache. Call on grid unmount. */
  dispose(): void {
    this.generation++;
    for (const controller of this.inFlight.values()) controller.abort();
    this.inFlight.clear();
    this.rows.clear();
    this.failedBlocks.clear();
  }

  // --- internals ---

  /** Fetch the block starting at `blockStart` unless already cached or in flight. */
  private ensureBlock(blockStart: number): void {
    if (this.inFlight.has(blockStart)) return;
    if (this.failedBlocks.has(blockStart)) return;
    // Skip when every row in the block is already cached.
    let allCached = true;
    const blockEnd = blockStart + this.blockSize;
    for (let i = blockStart; i < blockEnd; i++) {
      if (this.rowCount !== undefined && i >= this.rowCount) break;
      if (!this.rows.has(i)) {
        allCached = false;
        break;
      }
    }
    if (allCached) return;

    const generation = this.generation;
    const controller = new AbortController();
    this.inFlight.set(blockStart, controller);

    this.dataSource
      .getRows({
        start: blockStart,
        end: blockEnd,
        sort: this.context.sort,
        filters: this.context.filters,
        signal: controller.signal,
      })
      .then((result) => {
        if (generation !== this.generation || controller.signal.aborted) return;
        this.inFlight.delete(blockStart);
        result.items.forEach((row, offset) => {
          this.rows.set(blockStart + offset, row);
        });
        if (result.totalCount !== undefined) this.rowCount = result.totalCount;
        // Evict here too: a block fetched after `ensureRange` returned can push
        // the cache over the cap, and the in-flight check then skips eviction.
        this.evictIfNeeded();
        this.notify();
      })
      .catch((error) => {
        if (generation !== this.generation || controller.signal.aborted) return;
        this.inFlight.delete(blockStart);
        this.failedBlocks.add(blockStart);
        if (process.env.NODE_ENV !== 'production') {
          // Surface fetch failures in dev; production stays silent (placeholder shows error).
          console.error('[ogrid] windowed row block fetch failed', error);
        }
        this.notify();
      });
  }

  /** Re-fetch the total row count for the current context. */
  private async refreshRowCount(): Promise<void> {
    const generation = this.generation;
    const controller = new AbortController();
    try {
      const count = await this.dataSource.getRowCount({
        sort: this.context.sort,
        filters: this.context.filters,
        signal: controller.signal,
      });
      if (generation !== this.generation) return;
      this.rowCount = count;
      this.notify();
    } catch (error) {
      if (generation !== this.generation) return;
      if (process.env.NODE_ENV !== 'production') {
        console.error('[ogrid] windowed row count fetch failed', error);
      }
    }
  }

  /**
   * Evict cached blocks furthest from the last requested window once the cache
   * exceeds `maxCachedRows`. In-flight blocks are never evicted.
   */
  private evictIfNeeded(): void {
    if (this.maxCachedRows === 0 || this.rows.size <= this.maxCachedRows) return;

    // Group cached indices by block, then sort blocks by distance from the
    // last requested center; evict the farthest until back under the limit.
    const cachedBlocks = new Set<number>();
    for (const index of this.rows.keys()) {
      cachedBlocks.add(floorTo(index, this.blockSize));
    }
    const ordered = [...cachedBlocks].sort(
      (a, b) => Math.abs(b - this.lastRequestCenter) - Math.abs(a - this.lastRequestCenter)
    );
    for (const blockStart of ordered) {
      if (this.rows.size <= this.maxCachedRows) break;
      if (this.inFlight.has(blockStart)) continue;
      for (let i = blockStart; i < blockStart + this.blockSize; i++) {
        this.rows.delete(i);
      }
    }
  }

  private notify(): void {
    this.onChange?.();
  }
}

/**
 * Convenience factory mirroring the other `create*` helpers in core.
 * Equivalent to `new WindowedRowCache(opts)`.
 */
export function createWindowedRowCache<T>(opts: WindowedRowCacheOptions<T>): WindowedRowCache<T> {
  return new WindowedRowCache<T>(opts);
}
