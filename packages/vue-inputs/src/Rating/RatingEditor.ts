/**
 * RatingEditor — Premium star rating cell editor for OGrid (Vue).
 *
 * Usage:
 *   import { RatingEditor } from '@alaarab/ogrid-vue-inputs';
 *
 *   const columns = [{
 *     columnId: 'rating',
 *     cellEditor: RatingEditor,
 *     cellEditorPopup: true,
 *     cellEditorParams: { maxStars: 5, allowHalf: false },
 *   }];
 *
 * Implements ICellEditorProps<T> — works with cellEditorPopup: true.
 */
import { defineComponent, ref, computed, onMounted, h, type PropType, type CSSProperties } from 'vue';
import type { IColumnDef } from '@alaarab/ogrid-core';
import {
  clampRating,
  getStarFill,
  getRatingFromPosition,
  DEFAULT_MAX_STARS,
} from '@alaarab/ogrid-inputs';

// ── Styles ──

const rootStyle: CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '13px',
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  borderRadius: '8px',
  boxShadow: 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.15))',
  padding: '12px',
  userSelect: 'none',
  minWidth: '160px',
};

const starsRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  justifyContent: 'center',
  marginBottom: '8px',
};

const starBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px',
  fontSize: '24px',
  lineHeight: '1',
  color: 'var(--ogrid-accent, #0078d4)',
  borderRadius: '4px',
  transition: 'transform 0.1s',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: '8px',
  borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
};

const labelStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--ogrid-muted, #888)',
  fontWeight: 500,
};

const clearBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  color: 'var(--ogrid-accent, #0078d4)',
  fontWeight: 500,
};

// ── Component ──

export const RatingEditor = defineComponent({
  name: 'RatingEditor',
  props: {
    value: { default: undefined },
    onValueChange: { type: Function as PropType<(value: unknown) => void>, required: true },
    onCommit: { type: Function as PropType<() => void>, required: true },
    onCancel: { type: Function as PropType<() => void>, required: true },
    item: { type: Object, required: true },
    column: { type: Object as PropType<IColumnDef>, required: true },
    cellEditorParams: { type: Object, default: undefined },
  },
  setup(props) {
    const maxStars = computed<number>(() => (props.cellEditorParams?.maxStars as number | undefined) ?? DEFAULT_MAX_STARS);
    const allowHalf = computed<boolean>(() => (props.cellEditorParams?.allowHalf as boolean | undefined) ?? false);

    const parseInitialValue = (): number => {
      if (props.value == null) return 0;
      const n = parseFloat(String(props.value));
      return isNaN(n) ? 0 : clampRating(n, maxStars.value);
    };

    const currentRating = ref<number>(parseInitialValue());
    const hoverRating = ref<number | null>(null);
    const rootEl = ref<HTMLDivElement | null>(null);

    const displayRating = computed<number>(() => hoverRating.value ?? currentRating.value);

    const selectRating = (rating: number) => {
      const clamped = clampRating(rating, maxStars.value);
      currentRating.value = clamped;
      props.onValueChange(clamped);
      setTimeout(() => props.onCommit(), 0);
    };

    const handleStarClick = (starIndex: number, e: MouseEvent) => {
      const target = e.currentTarget as HTMLButtonElement;
      const rect = target.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const rating = getRatingFromPosition(starIndex, offsetX, rect.width, allowHalf.value);
      selectRating(rating);
    };

    const handleStarMouseMove = (starIndex: number, e: MouseEvent) => {
      const target = e.currentTarget as HTMLButtonElement;
      const rect = target.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      hoverRating.value = getRatingFromPosition(starIndex, offsetX, rect.width, allowHalf.value);
    };

    const handleClear = () => {
      currentRating.value = 0;
      props.onValueChange(0);
      props.onCommit();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        props.onCancel();
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = allowHalf.value ? 0.5 : 1;
        selectRating(clampRating(currentRating.value + step, maxStars.value));
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = allowHalf.value ? 0.5 : 1;
        selectRating(clampRating(currentRating.value - step, maxStars.value));
      }
    };

    onMounted(() => {
      rootEl.value?.focus();
    });

    return () => {
      const stars = Array.from({ length: maxStars.value }, (_, i) => {
        const fill = getStarFill(i, displayRating.value, allowHalf.value);
        const char = fill === 'full' ? '\u2605' : fill === 'half' ? '\u2BE8' : '\u2606';

        const btnStyle: CSSProperties = {
          ...starBtnStyle,
          color: fill === 'empty'
            ? 'var(--ogrid-muted, #ccc)'
            : 'var(--ogrid-accent, #0078d4)',
          transform: hoverRating.value !== null && i < hoverRating.value ? 'scale(1.15)' : 'scale(1)',
        };

        return h('button', {
          key: i,
          type: 'button',
          style: btnStyle,
          'aria-label': `${i + 1} star${i === 0 ? '' : 's'}`,
          onClick: (e: MouseEvent) => handleStarClick(i, e),
          onMousemove: (e: MouseEvent) => handleStarMouseMove(i, e),
          onMouseleave: () => { hoverRating.value = null; },
          tabindex: -1,
        }, char);
      });

      const ratingLabel = currentRating.value > 0
        ? `${currentRating.value}/${maxStars.value}`
        : 'No rating';

      return h(
        'div',
        {
          ref: rootEl,
          style: rootStyle,
          tabindex: 0,
          onKeydown: handleKeyDown,
          onMousedown: (e: MouseEvent) => e.stopPropagation(),
        },
        [
          h('div', { style: starsRowStyle }, stars),
          h('div', { style: footerStyle }, [
            h('span', { style: labelStyle }, ratingLabel),
            h('button', { type: 'button', style: clearBtnStyle, onClick: handleClear }, 'Clear'),
          ]),
        ]
      );
    };
  },
});
