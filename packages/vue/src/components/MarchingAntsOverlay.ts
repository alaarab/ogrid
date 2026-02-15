/**
 * MarchingAntsOverlay — Renders range overlays on top of the grid:
 *
 * 1. **Selection range**: solid green border around the current selection
 * 2. **Copy/Cut range**: animated dashed border (marching ants) like Excel
 *
 * Uses SVG rects positioned via cell data-attribute measurements.
 */
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, h, type PropType, type Ref } from 'vue';
import { Z_INDEX, measureRange, injectGlobalStyles, type ISelectionRange, type OverlayRect } from '@alaarab/ogrid-core';

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
    /** Items array — triggers re-measurement when data changes (e.g., sorting) */
    items: { type: Array as PropType<readonly unknown[]>, required: true },
    /** Visible columns — triggers re-measurement when columns are hidden/shown */
    visibleColumns: { type: Array as PropType<readonly string[] | undefined>, default: undefined },
    /** Column sizing overrides — triggers re-measurement when columns are resized */
    columnSizingOverrides: { type: Object as PropType<Record<string, { widthPx: number }>>, required: true },
    /** Column order — triggers re-measurement when columns are reordered */
    columnOrder: { type: Array as PropType<readonly string[] | undefined>, default: undefined },
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
      injectGlobalStyles('ogrid-marching-ants-keyframes', '@keyframes ogrid-marching-ants{to{stroke-dashoffset:-8}}');
    });

    // Measure when any range changes; re-measure on resize, column changes, data changes
    watch([() => props.selectionRange, clipRange, () => props.containerRef.value, () => props.items, () => props.visibleColumns, () => props.columnSizingOverrides, () => props.columnOrder], () => {
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
