/**
 * DOM helpers shared by `<OGrid>`'s two pointer drags, drag-select
 * (`useCellSelection`) and drag-fill (`useFillHandleInternal`). During a drag
 * the live range is shown by toggling data attributes on the cells instead of
 * re-rendering, and React state is committed once on pointerup. Internal: not
 * exported from the package.
 */
import { buildCellIndex, cellIndexKey } from '../utils';
import type { ISelectionRange } from '../types';

/** Marks a cell inside the live drag range. */
const DRAG_ATTR = 'data-drag-range';
/** Marks the drag-select anchor cell (keeps it unshaded, like Excel). */
const DRAG_ANCHOR_ATTR = 'data-drag-anchor';

/**
 * The body cell of `wrapper` under the viewport point (x, y), as a row and a
 * data column (column offset removed), or null over anything else: another
 * grid's cells, headers, or the checkbox / row-number columns.
 */
export function dataCellAtPoint(
  wrapper: HTMLElement | null,
  x: number,
  y: number,
  colOffset: number
): { row: number; col: number } | null {
  const cell = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest?.('[data-row-index][data-col-index]');
  if (!cell || (wrapper && !wrapper.contains(cell))) return null;
  const row = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
  const col = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
  if (Number.isNaN(row) || Number.isNaN(col) || col < colOffset) return null;
  return { row, col: col - colOffset };
}

export interface DragRangeMarker {
  /**
   * Mark the cells of `range` and unmark cells that left it. With `anchor`,
   * that cell also gets the anchor attribute. O(range) per call via a cell index.
   */
  mark: (range: ISelectionRange, anchor?: { row: number; col: number } | null) => void;
  /** Rebuild the cell index (e.g. once a drag really starts). */
  reindex: () => void;
  /** The indexed element of data cell (row, col), if rendered. */
  cellAt: (row: number, col: number) => HTMLElement | undefined;
  /** Unmark every marked cell and drop the index. O(marked). */
  clear: () => void;
}

/** One marker per drag listener lifetime; tracks the cells it marked. */
export function createDragRangeMarker(
  getWrapper: () => HTMLElement | null,
  getColOffset: () => number
): DragRangeMarker {
  const marked = new Set<HTMLElement>();
  let cellIndex: Map<number, HTMLElement> | null = null;

  const unmark = (el: HTMLElement) => {
    el.removeAttribute(DRAG_ATTR);
    el.removeAttribute(DRAG_ANCHOR_ATTR);
  };

  return {
    mark(range, anchor) {
      const wrapper = getWrapper();
      if (!wrapper) return;
      const minR = Math.min(range.startRow, range.endRow);
      const maxR = Math.max(range.startRow, range.endRow);
      const minC = Math.min(range.startCol, range.endCol);
      const maxC = Math.max(range.startCol, range.endCol);
      const colOff = getColOffset();

      // Unmark cells no longer in range (iterate the small set, not the DOM).
      for (const el of marked) {
        const r = parseInt(el.getAttribute('data-row-index') ?? '', 10);
        const c = parseInt(el.getAttribute('data-col-index') ?? '', 10) - colOff;
        if (!(r >= minR && r <= maxR && c >= minC && c <= maxC)) {
          unmark(el);
          marked.delete(el);
        }
      }

      if (!cellIndex) cellIndex = buildCellIndex(wrapper);
      // Virtual scroll recycles rows: on the first stale (disconnected)
      // element, rebuild the index once for this call and retry.
      let rebuilt = false;
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const key = cellIndexKey(r, c + colOff);
          let el = cellIndex.get(key);
          if (el && !el.isConnected && !rebuilt) {
            rebuilt = true;
            cellIndex = buildCellIndex(wrapper);
            el = cellIndex.get(key);
          }
          if (!el?.isConnected) continue;
          if (!el.hasAttribute(DRAG_ATTR)) el.setAttribute(DRAG_ATTR, '');
          if (anchor && r === anchor.row && c === anchor.col) {
            if (!el.hasAttribute(DRAG_ANCHOR_ATTR)) el.setAttribute(DRAG_ANCHOR_ATTR, '');
          } else if (el.hasAttribute(DRAG_ANCHOR_ATTR)) {
            el.removeAttribute(DRAG_ANCHOR_ATTR);
          }
          marked.add(el);
        }
      }
    },
    reindex() {
      cellIndex = buildCellIndex(getWrapper());
    },
    cellAt(row, col) {
      return cellIndex?.get(cellIndexKey(row, col + getColOffset()));
    },
    clear() {
      for (const el of marked) unmark(el);
      marked.clear();
      cellIndex = null;
    },
  };
}
