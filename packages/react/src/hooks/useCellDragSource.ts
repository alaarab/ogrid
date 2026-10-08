import { useCallback, useRef } from 'react';
import type * as React from 'react';
import type { RowId } from '../types';
import { useLatestRef } from './useLatestRef';

/** MIME type a cell drag source puts on the DataTransfer. */
export const OGRID_CELL_DRAG_MIME = 'application/x-ogrid-cell';

/** Data a cell drag source serialises onto the clipboard. */
export interface CellDragPayload {
  rowId?: RowId;
  columnId?: string;
  [key: string]: unknown;
}

export interface UseCellDragSourceParams {
  /** Row the source belongs to; put on the payload so a drop target can read it. */
  rowId?: RowId;
  /** Column the source belongs to. */
  columnId?: string;
  /** Extra application data serialised with the payload. */
  payload?: Record<string, unknown>;
  /** `dataTransfer.effectAllowed`; defaults to `'copyMove'`. */
  effectAllowed?: DataTransfer['effectAllowed'];
  /**
   * Only start the drag when the pointer pressed an element matching this
   * selector (e.g. `'[data-my-grip]'`). Lets a whole cell be draggable but
   * only from its handle.
   */
  handleSelector?: string;
}

/** Props `useCellDragSource` returns; spread them onto the draggable element. */
export interface CellDragSourceProps {
  draggable: true;
  'data-ogrid-allow-drag': '';
  onDragStart: (e: React.DragEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Make arbitrary content inside a cell a native HTML5 drag source without
 * fighting the grid's range selection.
 *
 * The element carries `data-ogrid-allow-drag`, which the grid's cell
 * pointer-down handler respects: a press on it never starts a range selection
 * or fill-handle drag, so the browser's drag can begin. The payload
 * (`{ rowId, columnId, ...payload }`) is serialised as JSON under
 * `application/json` and tagged with {@link OGRID_CELL_DRAG_MIME}.
 *
 * ```tsx
 * function Chip({ row, columnId }) {
 *   const drag = useCellDragSource({ rowId: row.id, columnId, payload: { label: row.name } });
 *   return <span {...drag}>{row.name}</span>;
 * }
 * // In renderCell: <Chip row={item} columnId="name" />
 * ```
 */
export function useCellDragSource(params: UseCellDragSourceParams = {}): CellDragSourceProps {
  const { rowId, columnId, payload, effectAllowed = 'copyMove', handleSelector } = params;
  const payloadRef = useLatestRef(payload);
  const pressedHandleRef = useRef(false);

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      if (handleSelector && !pressedHandleRef.current) {
        e.preventDefault();
        return;
      }
      pressedHandleRef.current = false;
      const dt = e.dataTransfer;
      if (!dt) return;
      dt.effectAllowed = effectAllowed;
      try {
        dt.setData('application/json', JSON.stringify({ rowId, columnId, ...payloadRef.current }));
        dt.setData(OGRID_CELL_DRAG_MIME, '');
      } catch {
        // Some browsers block setData during teardown; the drag still proceeds.
      }
    },
    [rowId, columnId, effectAllowed, handleSelector, payloadRef],
  );

  const stop = useCallback((e: React.SyntheticEvent) => {
    const handle = (e.target as Element | null)?.closest?.(handleSelector ?? '[data-ogrid-allow-drag]');
    pressedHandleRef.current = !!handle && e.currentTarget.contains(handle);
    // Keep the grid's range selection / fill handle from starting on the grip.
    e.stopPropagation();
  }, [handleSelector]);

  return {
    draggable: true,
    'data-ogrid-allow-drag': '',
    onDragStart,
    onPointerDown: stop,
    onMouseDown: stop,
  };
}
