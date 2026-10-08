import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import {
  applyRowOrder,
  computeRowOrderChange,
  normalizeSelectionRange,
} from '@alaarab/ogrid-core';
import type { IRowOrderChange } from '@alaarab/ogrid-core';
import type { IColumnDef, ISelectionRange, RowId } from '../types';
import { useLatestRef } from './useLatestRef';

/** Payload the grid puts on the DataTransfer for an internal row drag. */
export const OGRID_ROW_DRAG_MIME = 'application/x-ogrid-row';

/** The drop event handed to `onCellDrop`. */
export interface CellDropEvent<T> {
  rowId: RowId;
  columnId: string;
  dataTransfer: DataTransfer | null;
  files: File[];
  text: string;
  event: DragEvent;
  /** The row the drop landed on. */
  item: T;
  /** Display index the drop landed on. */
  rowIndex: number;
}

export interface UseGridDragDropParams<T> {
  /** Displayed rows, in order. */
  items: T[];
  getRowId: (item: T) => RowId;
  /** Visible columns the drop target indexes into. */
  visibleCols: IColumnDef<T>[];
  /** Leading (checkbox / row-number) columns before the data columns. */
  colOffset: number;
  wrapperRef: React.RefObject<HTMLElement | null>;
  /** Positioned ancestor the overlays are measured against (`.tableWidthAnchor`). */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Opt-in: drag the row handle (or selected rows) to reorder. */
  rowDragging?: boolean;
  /** Called with the new order. Omit to let the grid keep the order itself (uncontrolled). */
  onRowOrderChange?: (event: IRowOrderChange<T>) => void;
  /** Row dragging is disabled while a sort is active (like AG Grid's managed dragging). */
  sorted?: boolean;
  /** Opt-in: drag the selection border to move/copy the range. */
  rangeMove?: boolean;
  /** Current cell selection, for the range-move handle. */
  selectionRange: ISelectionRange | null;
  selectedRowIds: Set<RowId>;
  /** Active cell row, the fallback target for the keyboard reorder when no rows are selected. */
  activeCell?: { rowIndex: number; columnIndex: number } | null;
  /** Apply a range move through the grid's edit path. */
  moveRangeTo?: (targetRow: number, targetCol: number, copy: boolean) => void;
  /** Opt-in: accept external drops on cells. */
  cellDrop?: boolean;
  /** External drop handler. When set, the grid never writes the value itself. */
  onCellDrop?: (event: CellDropEvent<T>) => void;
  /** Apply dropped text through the grid's edit path (default `cellDrop` behavior). */
  dropTextAt?: (rowIndex: number, colIndex: number, text: string) => void;
  /** Record a row reorder as one undo step. */
  recordAction?: (action: { undo: () => void; redo: () => void }) => void;
}

export interface RowDropLine {
  top: number;
  left: number;
  width: number;
}

export interface UseGridDragDropResult<T> {
  /** `items` in the current order (reflects an uncontrolled reorder). */
  orderedItems: T[];
  isDraggingRow: boolean;
  isExternalDragOver: boolean;
  /** Where to draw the row drop indicator, relative to the positioned container. */
  dropLine: RowDropLine | null;
  /** Top-left corner of the range-move handle, relative to the positioned container. */
  rangeMoveHandle: { top: number; left: number } | null;
  /** Start a row drag from the handle in row `rowIndex`. */
  handleRowDragStart: (e: React.DragEvent, rowIndex: number) => void;
  /** Start a range move from the selection handle. */
  handleRangeMoveDragStart: (e: React.DragEvent) => void;
  /** True for the keyboard reorder (Ctrl/Cmd+Shift+Up/Down); preventDefault already called. */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  wrapperHandlers: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
}

/** Contiguous display indices covering every row in `rowIds`. */
function blockIndices<T>(items: T[], rowIds: Set<RowId>, getRowId: (item: T) => RowId): number[] {
  let first = -1;
  let last = -1;
  items.forEach((item, i) => {
    if (!rowIds.has(getRowId(item))) return;
    if (first === -1) first = i;
    last = i;
  });
  if (first === -1) return [];
  const out: number[] = [];
  for (let i = first; i <= last; i++) out.push(i);
  return out;
}

/** The body cell (data row + data column) under a viewport point, or null. */
function dataCellAt(
  wrapper: HTMLElement | null,
  x: number,
  y: number,
  colOffset: number,
): { row: number; col: number; el: HTMLElement } | null {
  const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest?.(
    '[data-row-index][data-col-index]',
  ) as HTMLElement | null;
  if (!el || (wrapper && !wrapper.contains(el))) return null;
  return coordsOf(el, colOffset);
}

/** Reads `data-row-index`/`data-col-index` off a content div. */
function coordsOf(el: HTMLElement, colOffset: number): { row: number; col: number; el: HTMLElement } | null {
  const row = Number.parseInt(el.getAttribute('data-row-index') ?? '', 10);
  const globalCol = Number.parseInt(el.getAttribute('data-col-index') ?? '', 10);
  if (Number.isNaN(row) || Number.isNaN(globalCol) || globalCol < colOffset) return null;
  return { row, col: globalCol - colOffset, el };
}

/** Resolve the drop cell from the event target first (the cell the event hit), then the point. */
function cellFromEvent(
  e: React.DragEvent,
  wrapper: HTMLElement | null,
  colOffset: number,
): { row: number; col: number; el: HTMLElement } | null {
  const el = (e.target as Element | null)?.closest?.('[data-row-index][data-col-index]') as HTMLElement | null;
  if (el && (!wrapper || wrapper.contains(el))) {
    const coords = coordsOf(el, colOffset);
    if (coords) return coords;
  }
  return dataCellAt(wrapper, e.clientX, e.clientY, colOffset);
}

const DROP_TARGET_ATTR = 'data-ogrid-drop-target';

/**
 * Shared drag-and-drop behavior for the mounted grid: row reordering (handle +
 * keyboard), range move via a selection handle, and external cell drops.
 * Pure display/positioning work is done on the DOM during the drag; React state
 * changes only when the drop line, handle or drag flags actually move.
 */
export function useGridDragDrop<T>(params: UseGridDragDropParams<T>): UseGridDragDropResult<T> {
  const {
    items, getRowId, visibleCols, colOffset, wrapperRef, containerRef,
    rowDragging, onRowOrderChange, sorted,
    rangeMove, selectionRange, selectedRowIds, activeCell, moveRangeTo,
    cellDrop, onCellDrop, dropTextAt, recordAction,
  } = params;

  const getRowIdRef = useLatestRef(getRowId);
  const visibleColsRef = useLatestRef(visibleCols);
  const colOffsetRef = useLatestRef(colOffset);

  // ── Uncontrolled order override ─────────────────────────────────────────
  const [orderOverride, setOrderOverride] = useState<RowId[] | null>(null);
  const appliedDataRef = useRef<T[] | null>(null);
  const orderedItems = useMemo(
    () => (orderOverride ? applyRowOrder(items, orderOverride, getRowId) : items),
    [items, orderOverride, getRowId],
  );
  const orderedItemsRef = useLatestRef(orderedItems);
  useEffect(() => {
    // A host that applied the move (or any external data change) ends the override.
    if (appliedDataRef.current !== null && items !== appliedDataRef.current) {
      appliedDataRef.current = null;
      setOrderOverride(null);
    }
  }, [items]);

  // ── Drag state ──────────────────────────────────────────────────────────
  const [isDraggingRow, setIsDraggingRow] = useState(false);
  const [isExternalDragOver, setIsExternalDragOver] = useState(false);
  const [dropLine, setDropLine] = useState<RowDropLine | null>(null);
  const [rangeMoveHandle, setRangeMoveHandle] = useState<{ top: number; left: number } | null>(null);

  const dragKindRef = useRef<'row' | 'range' | 'external' | null>(null);
  const rowBlockRef = useRef<number[]>([]);
  const dropGapRef = useRef<number | null>(null);
  const hoverCellRef = useRef<HTMLElement | null>(null);

  const clearDragState = useCallback(() => {
    dragKindRef.current = null;
    rowBlockRef.current = [];
    dropGapRef.current = null;
    if (hoverCellRef.current) {
      hoverCellRef.current.removeAttribute(DROP_TARGET_ATTR);
      hoverCellRef.current = null;
    }
    setIsDraggingRow(false);
    setIsExternalDragOver(false);
    setDropLine(null);
  }, []);

  // Safety net: a drag that ends outside the grid (no dragend on the wrapper).
  useEffect(() => {
    const onEnd = () => clearDragState();
    window.addEventListener('dragend', onEnd);
    return () => window.removeEventListener('dragend', onEnd);
  }, [clearDragState]);

  const applyRowOrderChange = useCallback(
    (event: IRowOrderChange<T>) => {
      const before = orderedItemsRef.current;
      const beforeIds = before.map(getRowIdRef.current);
      setOrderOverride(event.rowIds);
      appliedDataRef.current = event.data;
      onRowOrderChange?.(event);
      recordAction?.({
        undo: () => {
          setOrderOverride(beforeIds);
          appliedDataRef.current = before;
          onRowOrderChange?.({ rowIds: beforeIds, fromIndex: event.toIndex, toIndex: event.fromIndex, data: before });
        },
        redo: () => {
          setOrderOverride(event.rowIds);
          appliedDataRef.current = event.data;
          onRowOrderChange?.(event);
        },
      });
    },
    [onRowOrderChange, recordAction, getRowIdRef, orderedItemsRef],
  );

  const handleRowDragStart = useCallback(
    (e: React.DragEvent, rowIndex: number) => {
      if (!rowDragging || sorted) {
        e.preventDefault();
        return;
      }
      const rows = orderedItemsRef.current;
      const row = rows[rowIndex];
      const block =
        row !== undefined && selectedRowIds.has(getRowIdRef.current(row))
          ? blockIndices(rows, selectedRowIds, getRowIdRef.current)
          : [rowIndex];
      rowBlockRef.current = block.length > 0 ? block : [rowIndex];
      dragKindRef.current = 'row';
      setIsDraggingRow(true);
      const dt = e.dataTransfer;
      if (dt) {
        dt.effectAllowed = 'move';
        try {
          dt.setData(OGRID_ROW_DRAG_MIME, JSON.stringify({ rowIndex }));
          dt.setData('text/plain', '');
        } catch {
          // ignore
        }
      }
    },
    [rowDragging, sorted, selectedRowIds, getRowIdRef, orderedItemsRef],
  );

  const handleRangeMoveDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!rangeMove || !selectionRange) {
        e.preventDefault();
        return;
      }
      dragKindRef.current = 'range';
      const dt = e.dataTransfer;
      if (dt) {
        dt.effectAllowed = 'copyMove';
        try {
          dt.setData('application/x-ogrid-range', JSON.stringify(selectionRange));
          dt.setData('text/plain', '');
        } catch {
          // ignore
        }
      }
    },
    [rangeMove, selectionRange],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (dragKindRef.current === 'row') {
        const el = (e.target as Element | null)?.closest?.('[data-row-index]') as HTMLElement | null;
        if (!el) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = e.ctrlKey || e.metaKey ? 'copy' : 'move';
        const rowEl = (el.closest('tr') as HTMLElement | null) ?? el;
        const rect = rowEl.getBoundingClientRect();
        const row = Number.parseInt(el.getAttribute('data-row-index') ?? '', 10);
        if (Number.isNaN(row)) return;
        const before = e.clientY < rect.top + rect.height / 2;
        const gap = before ? row : row + 1;
        const container = containerRef.current;
        if (gap !== dropGapRef.current) {
          dropGapRef.current = gap;
          if (container) {
            const cRect = container.getBoundingClientRect();
            setDropLine({
              top: Math.round((before ? rect.top : rect.bottom) - cRect.top),
              left: Math.round(rect.left - cRect.left),
              width: Math.round(rect.width),
            });
          }
        }
        return;
      }

      // External drop: highlight the cell under the pointer.
      if (dragKindRef.current === null) {
        const target = cellFromEvent(e, wrapperRef.current, colOffsetRef.current);
        if (!target) {
          if (hoverCellRef.current) {
            hoverCellRef.current.removeAttribute(DROP_TARGET_ATTR);
            hoverCellRef.current = null;
            setIsExternalDragOver(false);
          }
          return;
        }
        if (!(onCellDrop || cellDrop)) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        if (hoverCellRef.current !== target.el) {
          hoverCellRef.current?.removeAttribute(DROP_TARGET_ATTR);
          target.el.setAttribute(DROP_TARGET_ATTR, '');
          hoverCellRef.current = target.el;
        }
        setIsExternalDragOver(true);
      }
    },
    [wrapperRef, containerRef, colOffsetRef, onCellDrop, cellDrop],
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      // Ignore moves between descendants of the wrapper.
      const related = e.relatedTarget as Node | null;
      if (related && wrapperRef.current?.contains(related)) return;
      if (hoverCellRef.current) {
        hoverCellRef.current.removeAttribute(DROP_TARGET_ATTR);
        hoverCellRef.current = null;
      }
      if (dragKindRef.current !== 'row') setIsExternalDragOver(false);
    },
    [wrapperRef],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const kind = dragKindRef.current;
      if (kind === 'row') {
        e.preventDefault();
        const gap = dropGapRef.current;
        const block = rowBlockRef.current;
        if (gap != null && block.length > 0) {
          const event = computeRowOrderChange(orderedItemsRef.current, block, gap, getRowIdRef.current);
          if (event) applyRowOrderChange(event);
        }
        clearDragState();
        return;
      }
      if (kind === 'range') {
        e.preventDefault();
        const target = cellFromEvent(e, wrapperRef.current, colOffsetRef.current);
        if (target) moveRangeTo?.(target.row, target.col, e.ctrlKey || e.metaKey);
        clearDragState();
        return;
      }
      // External drop.
      const target = cellFromEvent(e, wrapperRef.current, colOffsetRef.current);
      if (!target) {
        clearDragState();
        return;
      }
      const item = orderedItemsRef.current[target.row];
      const col = visibleColsRef.current[target.col];
      if (item === undefined || col === undefined) {
        clearDragState();
        return;
      }
      e.preventDefault();
      const dt = e.dataTransfer;
      const text = dt?.getData('text/plain') ?? '';
      const files = dt ? Array.from(dt.files ?? []) : [];
      if (onCellDrop) {
        onCellDrop({
          rowId: getRowIdRef.current(item),
          columnId: col.columnId,
          dataTransfer: dt,
          files,
          text,
          event: e.nativeEvent,
          item,
          rowIndex: target.row,
        });
      } else if (cellDrop && text.trim()) {
        dropTextAt?.(target.row, target.col, text);
      }
      clearDragState();
    },
    [applyRowOrderChange, clearDragState, moveRangeTo, onCellDrop, cellDrop, dropTextAt, wrapperRef, colOffsetRef, getRowIdRef, visibleColsRef, orderedItemsRef],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!rowDragging || sorted) return false;
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return false;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return false;
      const rows = orderedItemsRef.current;
      const selected = blockIndices(rows, selectedRowIds, getRowIdRef.current);
      const block = selected.length > 0
        ? selected
        : activeCell && activeCell.rowIndex < rows.length ? [activeCell.rowIndex] : [];
      if (block.length === 0) return false;
      const first = block[0] as number;
      const last = block[block.length - 1] as number;
      const gap = e.key === 'ArrowUp' ? Math.max(0, first - 1) : Math.min(rows.length, last + 2);
      const event = computeRowOrderChange(rows, block, gap, getRowIdRef.current);
      e.preventDefault();
      if (event) applyRowOrderChange(event);
      return true;
    },
    [rowDragging, sorted, selectedRowIds, activeCell, applyRowOrderChange, getRowIdRef, orderedItemsRef],
  );

  // ── Range-move handle position ──────────────────────────────────────────
  useLayoutEffect(() => {
    if (!rangeMove || !selectionRange) {
      setRangeMoveHandle(null);
      return;
    }
    const wrapper = wrapperRef.current;
    const container = containerRef.current;
    if (!wrapper || !container) {
      setRangeMoveHandle(null);
      return;
    }
    const norm = normalizeSelectionRange(selectionRange);
    const cell = wrapper.querySelector<HTMLElement>(
      `[data-row-index="${norm.startRow}"][data-col-index="${norm.startCol + colOffset}"]`,
    );
    if (!cell) {
      setRangeMoveHandle(null);
      return;
    }
    const cRect = container.getBoundingClientRect();
    const r = cell.getBoundingClientRect();
    setRangeMoveHandle({ top: Math.round(r.top - cRect.top), left: Math.round(r.left - cRect.left) });
  }, [rangeMove, selectionRange, colOffset, wrapperRef, containerRef]);

  const wrapperHandlers = useMemo(
    () => ({ onDragOver, onDragLeave, onDrop, onDragEnd: clearDragState }),
    [onDragOver, onDragLeave, onDrop, clearDragState],
  );

  return {
    orderedItems,
    isDraggingRow,
    isExternalDragOver,
    dropLine,
    rangeMoveHandle,
    handleRowDragStart,
    handleRangeMoveDragStart,
    handleKeyDown,
    wrapperHandlers,
  };
}
