/**
 * FormulaRefOverlay  -  Renders colored border overlays on cells referenced by
 * the active formula, like Excel's reference highlighting.
 *
 * Port of React's FormulaRefOverlay component.
 */

import { defineComponent, h, ref, watch, type PropType } from 'vue';
import { FORMULA_REF_COLORS, type FormulaReference } from '@alaarab/ogrid-core/formula';

interface RefRect {
  top: number;
  left: number;
  width: number;
  height: number;
  color: string;
}

function measureRef(
  container: HTMLElement,
  r: FormulaReference,
  colOffset: number,
): RefRect | null {
  const startCol = r.col + colOffset;
  const endCol = (r.endCol ?? r.col) + colOffset;
  const endRow = r.endRow ?? r.row;

  const tl = container.querySelector(
    `[data-row-index="${r.row}"][data-col-index="${startCol}"]`
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
    color: FORMULA_REF_COLORS[r.colorIndex % FORMULA_REF_COLORS.length],
  };
}

export const FormulaRefOverlay = defineComponent({
  name: 'FormulaRefOverlay',
  props: {
    containerEl: { type: Object as PropType<HTMLElement | null>, default: null },
    references: { type: Array as PropType<FormulaReference[]>, required: true },
    colOffset: { type: Number, required: true },
  },
  setup(props) {
    const rects = ref<RefRect[]>([]);
    let rafId = 0;

    function measureAll() {
      const container = props.containerEl;
      const refs = props.references;
      if (!container || refs.length === 0) {
        rects.value = [];
        return;
      }
      const measured: RefRect[] = [];
      for (const r of refs) {
        const rect = measureRef(container, r, props.colOffset);
        if (rect) measured.push(rect);
      }
      rects.value = measured;
    }

    watch(
      () => [props.references, props.containerEl, props.colOffset] as const,
      () => {
        cancelAnimationFrame(rafId);
        if (!props.containerEl || props.references.length === 0) {
          rects.value = [];
          return;
        }
        rafId = requestAnimationFrame(measureAll);
      },
      { immediate: true },
    );

    return () => {
      if (rects.value.length === 0) return null;
      return rects.value.map((r, i) =>
        h('svg', {
          key: i,
          style: {
            position: 'absolute',
            top: `${r.top}px`,
            left: `${r.left}px`,
            width: `${r.width}px`,
            height: `${r.height}px`,
            pointerEvents: 'none',
            zIndex: 3,
            overflow: 'visible',
          },
          'aria-hidden': 'true',
        }, [
          h('rect', {
            x: '1',
            y: '1',
            width: Math.max(0, r.width - 2),
            height: Math.max(0, r.height - 2),
            fill: 'none',
            stroke: r.color,
            'stroke-width': '2',
            style: 'shape-rendering: crispEdges',
          }),
        ]),
      );
    };
  },
});
