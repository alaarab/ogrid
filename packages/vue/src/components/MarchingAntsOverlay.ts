/**
 * MarchingAntsOverlay — Renders range overlays on top of the grid:
 *
 * 1. **Selection range**: solid green border around the current selection
 * 2. **Copy/Cut range**: animated dashed border (marching ants) like Excel
 *
 * Uses SVG rects positioned via cell data-attribute measurements.
 */
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, h, type PropType, type Ref } from 'vue';
import { Z_INDEX, type ISelectionRange } from '@alaarab/ogrid-core';

// Inject the @keyframes rule once into <head> (deduplicates across multiple OGrid instances)
function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ogrid-marching-ants-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'ogrid-marching-ants-keyframes';
  style.textContent =
    '@keyframes ogrid-marching-ants{to{stroke-dashoffset:-8}}';
  document.head.appendChild(style);
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

export const MarchingAntsOverlay = defineComponent({
  name: 'MarchingAntsOverlay',
  props: {
    /** Ref to the positioned container that wraps the table (must have position: relative) */
    containerRef: { type: Object as PropType<Ref<HTMLElement | null>>, required: true },
    /** Current selection range — solid green border */
    selectionRange: { type: Object as PropType<ISelectionRange | null>, default: null },
    /** Copy range — animated dashed border */
    copyRange: { type: Object as PropType<ISelectionRange | null>, default: null },
    /** Cut range — animated dashed border */
    cutRange: { type: Object as PropType<ISelectionRange | null>, default: null },
    /** Column offset — 1 when checkbox column is present, else 0 */
    colOffset: { type: Number, required: true },
  },
  setup(props) {
    const selRect = ref<OverlayRect | null>(null);
    const clipRect = ref<OverlayRect | null>(null);
    let rafId = 0;
    let ro: ResizeObserver | undefined;

    const clipRange = computed(() => props.copyRange ?? props.cutRange);

    const measureAll = () => {
      const container = props.containerRef.value;
      if (!container) {
        selRect.value = null;
        clipRect.value = null;
        return;
      }

      selRect.value = props.selectionRange ? measureRange(container, props.selectionRange, props.colOffset) : null;
      clipRect.value = clipRange.value ? measureRange(container, clipRange.value, props.colOffset) : null;
    };

    // Inject keyframes on mount
    onMounted(() => {
      ensureKeyframes();
    });

    // Measure when any range changes; re-measure on resize
    watch([() => props.selectionRange, clipRange, () => props.containerRef.value], () => {
      if (!props.selectionRange && !clipRange.value) {
        selRect.value = null;
        clipRect.value = null;
        return;
      }

      // Delay one frame so cells are rendered
      rafId = requestAnimationFrame(measureAll);

      const container = props.containerRef.value;
      if (container) {
        ro?.disconnect();
        ro = new ResizeObserver(measureAll);
        ro.observe(container);
      }
    }, { immediate: true });

    onUnmounted(() => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
    });

    const clipRangeMatchesSel = computed(() => {
      const sel = props.selectionRange;
      const clip = clipRange.value;
      return (
        sel != null &&
        clip != null &&
        sel.startRow === clip.startRow &&
        sel.startCol === clip.startCol &&
        sel.endRow === clip.endRow &&
        sel.endCol === clip.endCol
      );
    });

    return () => {
      if (!selRect.value && !clipRect.value) return null;

      return h('div', { style: { position: 'relative' } }, [
        // Selection range: solid green border (hidden when clipboard range overlaps)
        selRect.value && !clipRangeMatchesSel.value ? h('svg', {
          style: {
            position: 'absolute',
            top: `${selRect.value.top}px`,
            left: `${selRect.value.left}px`,
            width: `${selRect.value.width}px`,
            height: `${selRect.value.height}px`,
            pointerEvents: 'none',
            zIndex: Z_INDEX.SELECTION_OVERLAY,
            overflow: 'visible',
          },
          'aria-hidden': 'true',
        }, [
          h('rect', {
            x: 1,
            y: 1,
            width: Math.max(0, selRect.value.width - 2),
            height: Math.max(0, selRect.value.height - 2),
            fill: 'none',
            stroke: 'var(--ogrid-selection, #217346)',
            'stroke-width': 2,
          }),
        ]) : null,

        // Copy/Cut range: animated marching ants
        clipRect.value ? h('svg', {
          style: {
            position: 'absolute',
            top: `${clipRect.value.top}px`,
            left: `${clipRect.value.left}px`,
            width: `${clipRect.value.width}px`,
            height: `${clipRect.value.height}px`,
            pointerEvents: 'none',
            zIndex: Z_INDEX.CLIPBOARD_OVERLAY,
            overflow: 'visible',
          },
          'aria-hidden': 'true',
        }, [
          h('rect', {
            x: 1,
            y: 1,
            width: Math.max(0, clipRect.value.width - 2),
            height: Math.max(0, clipRect.value.height - 2),
            fill: 'none',
            stroke: 'var(--ogrid-selection, #217346)',
            'stroke-width': 2,
            'stroke-dasharray': '4 4',
            style: {
              animation: 'ogrid-marching-ants 0.5s linear infinite',
            },
          }),
        ]) : null,
      ]);
    };
  },
});
