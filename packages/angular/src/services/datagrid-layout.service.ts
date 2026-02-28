import { signal, computed, effect, NgZone } from '@angular/core';
import {
  flattenColumns,
  CHECKBOX_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
  CELL_PADDING,
  resolveResponsiveConfig,
  applyResponsiveHiding,
} from '@alaarab/ogrid-core';
import type { RowId } from '../types';
import type { IColumnDef as IAngularColumnDef } from '../types';
import type { IOGridDataGridProps } from '../types';

type IColumnDef<T> = IAngularColumnDef<T>;

/**
 * Manages column layout, visibility, sizing, and container measurement.
 * Extracted from DataGridStateService for modularity.
 *
 * Not @Injectable — instantiated and owned by DataGridStateService.
 */
export class DataGridLayoutHelper<T> {
  // --- Input signals (shared with parent) ---
  readonly props: ReturnType<typeof signal<IOGridDataGridProps<T> | null>>;
  readonly wrapperEl: ReturnType<typeof signal<HTMLElement | null>>;

  // --- Internal state ---
  readonly containerWidthSig = signal<number>(0);
  readonly columnSizingOverridesSig = signal<Record<string, { widthPx: number }>>({});

  // ResizeObserver
  private resizeObserver: ResizeObserver | null = null;

  // --- Derived computed ---
  private readonly initialColumnWidthsSig: ReturnType<typeof computed<Record<string, number> | undefined>>;

  readonly flatColumnsRaw: ReturnType<typeof computed<IColumnDef<T>[]>>;
  readonly flatColumns: ReturnType<typeof computed<IColumnDef<T>[]>>;
  readonly visibleCols: ReturnType<typeof computed<IColumnDef<T>[]>>;
  readonly visibleColumnCount: ReturnType<typeof computed<number>>;
  readonly hasCheckboxCol: ReturnType<typeof computed<boolean>>;
  readonly hasRowNumbersCol: ReturnType<typeof computed<boolean>>;
  readonly specialColsCount: ReturnType<typeof computed<number>>;
  readonly totalColCount: ReturnType<typeof computed<number>>;
  readonly colOffset: ReturnType<typeof computed<number>>;
  readonly rowIndexByRowId: ReturnType<typeof computed<Map<RowId, number>>>;
  readonly minTableWidth: ReturnType<typeof computed<number>>;
  readonly desiredTableWidth: ReturnType<typeof computed<number>>;

  constructor(
    props: ReturnType<typeof signal<IOGridDataGridProps<T> | null>>,
    wrapperEl: ReturnType<typeof signal<HTMLElement | null>>,
    ngZone: NgZone
  ) {
    this.props = props;
    this.wrapperEl = wrapperEl;

    this.initialColumnWidthsSig = computed(() => this.props()?.initialColumnWidths);

    this.flatColumnsRaw = computed(() => {
      const p = this.props();
      if (!p) return [] as IColumnDef<T>[];
      return flattenColumns(p.columns) as IColumnDef<T>[];
    });

    this.flatColumns = computed(() => {
      const raw = this.flatColumnsRaw();
      const p = this.props();
      const pinnedColumns = p?.pinnedColumns;
      if (!pinnedColumns || Object.keys(pinnedColumns).length === 0) return raw;
      return raw.map((col) => {
        const override = pinnedColumns[col.columnId];
        if (override && col.pinned !== override) return { ...col, pinned: override };
        return col;
      });
    });

    this.visibleCols = computed(() => {
      const p = this.props();
      if (!p) return [] as IColumnDef<T>[];
      const flatCols = this.flatColumns();
      const filtered = p.visibleColumns
        ? flatCols.filter((c) => p.visibleColumns.has(c.columnId))
        : flatCols;
      let ordered: IColumnDef<T>[];
      const order = p.columnOrder;
      if (!order?.length) {
        ordered = filtered;
      } else {
        const orderMap = new Map<string, number>();
        for (let i = 0; i < order.length; i++) {
          orderMap.set(order[i], i);
        }
        ordered = [...filtered].sort((a, b) => {
          const ia = orderMap.get(a.columnId) ?? -1;
          const ib = orderMap.get(b.columnId) ?? -1;
          if (ia === -1 && ib === -1) return 0;
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
      }
      // Responsive column hiding
      return applyResponsiveHiding(ordered, this.containerWidthSig(), resolveResponsiveConfig(p.responsiveColumns)) as IColumnDef<T>[];
    });

    this.visibleColumnCount = computed(() => this.visibleCols().length);
    this.hasCheckboxCol = computed(() => (this.props()?.rowSelection ?? 'none') === 'multiple');
    this.hasRowNumbersCol = computed(() => !!this.props()?.showRowNumbers);
    this.specialColsCount = computed(() => (this.hasCheckboxCol() ? 1 : 0) + (this.hasRowNumbersCol() ? 1 : 0));
    this.totalColCount = computed(() => this.visibleColumnCount() + this.specialColsCount());
    this.colOffset = computed(() => this.specialColsCount());

    this.rowIndexByRowId = computed(() => {
      const p = this.props();
      if (!p) return new Map<RowId, number>();
      const m = new Map<RowId, number>();
      p.items.forEach((item, idx) => m.set(p.getRowId(item), idx));
      return m;
    });

    this.minTableWidth = computed(() => {
      const checkboxW = this.hasCheckboxCol() ? CHECKBOX_COLUMN_WIDTH : 0;
      return this.visibleCols().reduce(
        (sum, c) => sum + (c.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH) + CELL_PADDING,
        checkboxW,
      );
    });

    this.desiredTableWidth = computed(() => {
      const checkboxW = this.hasCheckboxCol() ? CHECKBOX_COLUMN_WIDTH : 0;
      const overrides = this.columnSizingOverridesSig();
      return this.visibleCols().reduce((sum, c) => {
        const override = overrides[c.columnId];
        const w = override
          ? override.widthPx
          : (c.idealWidth ?? c.defaultWidth ?? c.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH);
        return sum + Math.max(c.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH, w) + CELL_PADDING;
      }, checkboxW);
    });

    // Initialize column sizing overrides from initial widths
    effect(() => {
      const widths = this.initialColumnWidthsSig();
      if (widths) {
        const result: Record<string, { widthPx: number }> = {};
        for (const [id, width] of Object.entries(widths)) {
          result[id] = { widthPx: width };
        }
        this.columnSizingOverridesSig.set(result);
      }
    });

    // Container width measurement via ResizeObserver
    effect(() => {
      const el = this.wrapperEl();
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      if (!el) return;
      const measure = () => {
        const rect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        const borderX =
          (parseFloat(cs.borderLeftWidth || '0') || 0) +
          (parseFloat(cs.borderRightWidth || '0') || 0);
        this.containerWidthSig.set(Math.max(0, rect.width - borderX));
      };
      ngZone.runOutsideAngular(() => {
        this.resizeObserver = new ResizeObserver(measure);
        this.resizeObserver.observe(el);
      });
      measure();
    });

    // Clean up column sizing overrides for removed columns
    effect(() => {
      const colIds = new Set(this.flatColumns().map((c) => c.columnId));
      this.columnSizingOverridesSig.update((prev) => {
        const next: Record<string, { widthPx: number }> = {};
        let changed = false;
        for (const [id, value] of Object.entries(prev)) {
          if (colIds.has(id)) {
            next[id] = value;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}
