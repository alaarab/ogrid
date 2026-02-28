/**
 * FormulaRefOverlay — Renders colored border overlays on cells referenced by
 * the active formula, like Excel's reference highlighting.
 *
 * Uses the same container measurement pattern as MarchingAntsOverlay.
 */

import * as React from 'react';
import { useEffect, useState, useCallback, useRef, memo } from 'react';
import { FORMULA_REF_COLORS, type FormulaReference } from '@alaarab/ogrid-core/formula';

interface RefRect {
  top: number;
  left: number;
  width: number;
  height: number;
  color: string;
}

export interface FormulaRefOverlayProps {
  /** Ref to the positioned container that wraps the table. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** References to highlight. */
  references: FormulaReference[];
  /** Column offset (1 when checkbox/row-number columns are present). */
  colOffset: number;
}

/** Shared SVG rect style — avoids recreating on every render. */
const CRISP_EDGES: React.CSSProperties = { shapeRendering: 'crispEdges' };

function measureRef(
  container: HTMLElement,
  ref: FormulaReference,
  colOffset: number,
): RefRect | null {
  const startCol = ref.col + colOffset;
  const endCol = (ref.endCol ?? ref.col) + colOffset;
  const endRow = ref.endRow ?? ref.row;

  const tl = container.querySelector(
    `[data-row-index="${ref.row}"][data-col-index="${startCol}"]`
  ) as HTMLElement | null;
  const br = container.querySelector(
    `[data-row-index="${endRow}"][data-col-index="${endCol}"]`
  ) as HTMLElement | null;

  if (!tl || !br) return null;

  const cRect = container.getBoundingClientRect();
  const tlRect = tl.getBoundingClientRect();
  const brRect = br.getBoundingClientRect();

  return {
    top: Math.round(tlRect.top - cRect.top),
    left: Math.round(tlRect.left - cRect.left),
    width: Math.round(brRect.right - tlRect.left),
    height: Math.round(brRect.bottom - tlRect.top),
    color: FORMULA_REF_COLORS[ref.colorIndex % FORMULA_REF_COLORS.length],
  };
}

function FormulaRefOverlayInner({
  containerRef,
  references,
  colOffset,
}: FormulaRefOverlayProps): React.ReactElement | null {
  const [rects, setRects] = useState<RefRect[]>([]);
  const rafRef = useRef(0);

  const measureAll = useCallback(() => {
    const container = containerRef.current;
    if (!container || references.length === 0) {
      setRects([]);
      return;
    }
    const measured: RefRect[] = [];
    for (const ref of references) {
      const r = measureRef(container, ref, colOffset);
      if (r) measured.push(r);
    }
    setRects(measured);
  }, [references, containerRef, colOffset]);

  useEffect(() => {
    if (references.length === 0) {
      setRects([]);
      return;
    }
    rafRef.current = requestAnimationFrame(measureAll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [references, measureAll]);

  if (rects.length === 0) return null;

  return (
    <>
      {rects.map((r, i) => (
        <svg
          key={i}
          style={{
            position: 'absolute',
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
            pointerEvents: 'none',
            zIndex: 3,
            overflow: 'visible',
          }}
          aria-hidden="true"
        >
          <rect
            x="1"
            y="1"
            width={Math.max(0, r.width - 2)}
            height={Math.max(0, r.height - 2)}
            fill="none"
            stroke={r.color}
            strokeWidth="2"
            style={CRISP_EDGES}
          />
        </svg>
      ))}
    </>
  );
}

export const FormulaRefOverlay = memo(FormulaRefOverlayInner);
