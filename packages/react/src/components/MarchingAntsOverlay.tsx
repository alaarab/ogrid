/**
 * MarchingAntsOverlay — Renders range overlays on top of the grid:
 *
 * 1. **Selection range**: solid green border around the current selection
 * 2. **Copy/Cut range**: animated dashed border (marching ants) like Excel
 *
 * Uses SVG rects positioned via cell data-attribute measurements.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import * as React from 'react';
import type { ISelectionRange } from '../types';
import { measureRange, injectGlobalStyles, type OverlayRect } from '@alaarab/ogrid-core';

const MARCHING_ANTS_ANIMATION: React.CSSProperties = { animation: 'ogrid-marching-ants 0.5s linear infinite' };

export interface MarchingAntsOverlayProps {
  /** Ref to the positioned container that wraps the table (must have position: relative) */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Current selection range — solid green border */
  selectionRange: ISelectionRange | null;
  /** Copy range — animated dashed border */
  copyRange: ISelectionRange | null;
  /** Cut range — animated dashed border */
  cutRange: ISelectionRange | null;
  /** Column offset — 1 when checkbox column is present, else 0 */
  colOffset: number;
  /** Items array — triggers re-measurement when data changes (e.g., sorting) */
  items: readonly unknown[];
  /** Visible columns — triggers re-measurement when columns are hidden/shown */
  visibleColumns: Set<string> | undefined;
  /** Column sizing overrides — triggers re-measurement when columns are resized */
  columnSizingOverrides: Record<string, { widthPx: number }>;
  /** Column order — triggers re-measurement when columns are reordered */
  columnOrder: readonly string[] | undefined;
}

export function MarchingAntsOverlay({
  containerRef,
  selectionRange,
  copyRange,
  cutRange,
  colOffset,
  items,
  visibleColumns,
  columnSizingOverrides,
  columnOrder,
}: MarchingAntsOverlayProps): React.ReactElement | null {
  const [selRect, setSelRect] = useState<OverlayRect | null>(null);
  const [clipRect, setClipRect] = useState<OverlayRect | null>(null);
  const rafRef = useRef(0);

  const clipRange = copyRange ?? cutRange;

  const measureAll = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      setSelRect(null);
      setClipRect(null);
      return;
    }

    setSelRect(selectionRange ? measureRange(container, selectionRange, colOffset) : null);
    setClipRect(clipRange ? measureRange(container, clipRange, colOffset) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionRange, clipRange, containerRef, colOffset, items, visibleColumns, columnSizingOverrides, columnOrder]);

  // Inject keyframes on mount
  useEffect(() => {
    injectGlobalStyles('ogrid-marching-ants-keyframes', '@keyframes ogrid-marching-ants{to{stroke-dashoffset:-8}}');
  }, []);

  // Measure when any range changes; re-measure on resize
  useEffect(() => {
    if (!selectionRange && !clipRange) {
      setSelRect(null);
      setClipRect(null);
      return;
    }

    // Delay one frame so cells are rendered
    rafRef.current = requestAnimationFrame(measureAll);

    const container = containerRef.current;
    let ro: ResizeObserver | undefined;
    if (container) {
      ro = new ResizeObserver(measureAll);
      ro.observe(container);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
    };
  }, [selectionRange, clipRange, measureAll, containerRef]);

  if (!selRect && !clipRect) return null;

  // When clipboard range matches the selection range, hide the solid selection border
  // so the marching ants animation is clearly visible (not obscured by solid stroke underneath).
  const clipRangeMatchesSel =
    selectionRange != null &&
    clipRange != null &&
    selectionRange.startRow === clipRange.startRow &&
    selectionRange.startCol === clipRange.startCol &&
    selectionRange.endRow === clipRange.endRow &&
    selectionRange.endCol === clipRange.endCol;

  return (
    <>
      {/* Selection range: solid green border (hidden when clipboard range overlaps) */}
      {selRect && !clipRangeMatchesSel && (
        <svg
          style={{
            position: 'absolute',
            top: selRect.top,
            left: selRect.left,
            width: selRect.width,
            height: selRect.height,
            pointerEvents: 'none',
            zIndex: 4,
            overflow: 'visible',
          }}
          aria-hidden="true"
        >
          <rect
            x="1"
            y="1"
            width={Math.max(0, selRect.width - 2)}
            height={Math.max(0, selRect.height - 2)}
            fill="none"
            stroke="var(--ogrid-selection, #217346)"
            strokeWidth="2"
          />
        </svg>
      )}

      {/* Copy/Cut range: animated marching ants */}
      {clipRect && (
        <svg
          style={{
            position: 'absolute',
            top: clipRect.top,
            left: clipRect.left,
            width: clipRect.width,
            height: clipRect.height,
            pointerEvents: 'none',
            zIndex: 5,
            overflow: 'visible',
          }}
          aria-hidden="true"
        >
          <rect
            x="1"
            y="1"
            width={Math.max(0, clipRect.width - 2)}
            height={Math.max(0, clipRect.height - 2)}
            fill="none"
            stroke="var(--ogrid-selection, #217346)"
            strokeWidth="2"
            strokeDasharray="4 4"
            style={MARCHING_ANTS_ANIMATION}
          />
        </svg>
      )}
    </>
  );
}
