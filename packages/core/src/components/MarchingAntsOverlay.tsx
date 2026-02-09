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
}

// Inject the @keyframes rule once into <head>
let styleInjected = false;
function ensureKeyframes() {
  if (styleInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.id = 'ogrid-marching-ants-keyframes';
  style.textContent =
    '@keyframes ogrid-marching-ants{to{stroke-dashoffset:-8}}';
  document.head.appendChild(style);
  styleInjected = true;
}

interface OverlayRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Measure the bounding rect of a range within a container. */
function measureRange(
  container: HTMLElement,
  range: ISelectionRange,
  colOffset: number
): OverlayRect | null {
  const startGlobalCol = range.startCol + colOffset;
  const endGlobalCol = range.endCol + colOffset;

  const topLeft = container.querySelector(
    `[data-row-index="${range.startRow}"][data-col-index="${startGlobalCol}"]`
  ) as HTMLElement | null;
  const bottomRight = container.querySelector(
    `[data-row-index="${range.endRow}"][data-col-index="${endGlobalCol}"]`
  ) as HTMLElement | null;

  if (!topLeft || !bottomRight) return null;

  const cRect = container.getBoundingClientRect();
  const tlRect = topLeft.getBoundingClientRect();
  const brRect = bottomRight.getBoundingClientRect();

  return {
    top: tlRect.top - cRect.top,
    left: tlRect.left - cRect.left,
    width: brRect.right - tlRect.left,
    height: brRect.bottom - tlRect.top,
  };
}

export function MarchingAntsOverlay({
  containerRef,
  selectionRange,
  copyRange,
  cutRange,
  colOffset,
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
  }, [selectionRange, clipRange, containerRef, colOffset]);

  // Inject keyframes on mount
  useEffect(() => {
    ensureKeyframes();
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

  return (
    <>
      {/* Selection range: solid green border */}
      {selRect && (
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
            style={{ animation: 'ogrid-marching-ants 0.5s linear infinite' }}
          />
        </svg>
      )}
    </>
  );
}
