/**
 * SliderEditor — Premium range slider cell editor for OGrid (Vue).
 *
 * Usage:
 *   import { SliderEditor } from '@alaarab/ogrid-vue-inputs';
 *
 *   const columns = [{
 *     columnId: 'priority',
 *     cellEditor: SliderEditor,
 *     cellEditorPopup: true,
 *     cellEditorParams: { min: 0, max: 100, step: 5 },
 *   }];
 *
 * Implements ICellEditorProps<T> — works with cellEditorPopup: true.
 */
import { defineComponent, ref, computed, onMounted, onUnmounted, h, type PropType, type CSSProperties } from 'vue';
import type { IColumnDef } from '@alaarab/ogrid-core';
import {
  clampValue,
  snapToStep,
  getPercentage,
  getValueFromOffset,
  DEFAULT_MIN,
  DEFAULT_MAX,
  DEFAULT_STEP,
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
  width: '260px',
};

const valueRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '10px',
};

const valueLabelStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: '15px',
  color: 'var(--ogrid-accent, #0078d4)',
};

const numberInputStyle: CSSProperties = {
  width: '64px',
  padding: '4px 8px',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
  borderRadius: '4px',
  fontSize: '13px',
  outline: 'none',
  background: 'var(--ogrid-bg, #fff)',
  color: 'inherit',
  textAlign: 'right',
};

const trackContainerStyle: CSSProperties = {
  position: 'relative',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  marginBottom: '6px',
};

const trackStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: '4px',
  borderRadius: '2px',
  background: 'var(--ogrid-border, rgba(0,0,0,0.15))',
};

const minMaxRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '11px',
  color: 'var(--ogrid-muted, #888)',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '6px',
  marginTop: '10px',
  paddingTop: '8px',
  borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
};

const actionBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 10px',
  borderRadius: '4px',
  fontSize: '12px',
  color: 'var(--ogrid-accent, #0078d4)',
  fontWeight: 500,
};

// ── Component ──

export const SliderEditor = defineComponent({
  name: 'SliderEditor',
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
    const min = computed<number>(() => (props.cellEditorParams?.min as number | undefined) ?? DEFAULT_MIN);
    const max = computed<number>(() => (props.cellEditorParams?.max as number | undefined) ?? DEFAULT_MAX);
    const step = computed<number>(() => (props.cellEditorParams?.step as number | undefined) ?? DEFAULT_STEP);

    const parseInitialValue = (): number => {
      if (props.value == null) return min.value;
      const n = parseFloat(String(props.value));
      if (isNaN(n)) return min.value;
      return clampValue(snapToStep(n, min.value, step.value), min.value, max.value);
    };

    const currentValue = ref<number>(parseInitialValue());
    const trackEl = ref<HTMLDivElement | null>(null);
    const rootEl = ref<HTMLDivElement | null>(null);
    const isDragging = ref(false);

    const percentage = computed<number>(() => getPercentage(currentValue.value, min.value, max.value));

    const setValue = (v: number) => {
      const clamped = clampValue(snapToStep(v, min.value, step.value), min.value, max.value);
      currentValue.value = clamped;
      props.onValueChange(clamped);
    };

    const getValueFromEvent = (e: MouseEvent): number => {
      const track = trackEl.value;
      if (!track) return currentValue.value;
      const rect = track.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      return getValueFromOffset(offsetX, rect.width, min.value, max.value, step.value);
    };

    const handleTrackClick = (e: MouseEvent) => {
      setValue(getValueFromEvent(e));
    };

    const handleTrackMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      isDragging.value = true;
      setValue(getValueFromEvent(e));

      const handleMouseMove = (ev: MouseEvent) => {
        if (isDragging.value) setValue(getValueFromEvent(ev));
      };
      const handleMouseUp = () => {
        isDragging.value = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    const handleNumberInput = (e: Event) => {
      const raw = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(raw)) setValue(raw);
    };

    const handleNumberKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        props.onCommit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        props.onCancel();
      }
    };

    const handleRootKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        setValue(currentValue.value + step.value);
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        setValue(currentValue.value - step.value);
      }
      if (e.key === 'Home') {
        e.preventDefault();
        setValue(min.value);
      }
      if (e.key === 'End') {
        e.preventDefault();
        setValue(max.value);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        props.onCommit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        props.onCancel();
      }
    };

    onMounted(() => {
      rootEl.value?.focus();
    });

    onUnmounted(() => {
      // Cleanup handled inline in mousedown handler
    });

    return () => {
      const thumbStyle: CSSProperties = {
        position: 'absolute',
        top: '50%',
        left: `${percentage.value}%`,
        transform: 'translate(-50%, -50%)',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: 'var(--ogrid-accent, #0078d4)',
        border: '2px solid #fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        cursor: isDragging.value ? 'grabbing' : 'grab',
        zIndex: 1,
        boxSizing: 'border-box',
      };

      const fillStyle: CSSProperties = {
        position: 'absolute',
        left: 0,
        width: `${percentage.value}%`,
        height: '4px',
        borderRadius: '2px',
        background: 'var(--ogrid-accent, #0078d4)',
      };

      return h(
        'div',
        {
          ref: rootEl,
          style: rootStyle,
          tabindex: 0,
          onKeydown: handleRootKeyDown,
          onMousedown: (e: MouseEvent) => e.stopPropagation(),
        },
        [
          // Value display row
          h('div', { style: valueRowStyle }, [
            h('span', { style: valueLabelStyle }, String(currentValue.value)),
            h('input', {
              type: 'number',
              value: currentValue.value,
              min: min.value,
              max: max.value,
              step: step.value,
              style: numberInputStyle,
              onInput: handleNumberInput,
              onKeydown: handleNumberKeyDown,
              onClick: (e: MouseEvent) => e.stopPropagation(),
              tabindex: 0,
            }),
          ]),

          // Track
          h('div', {
            ref: trackEl,
            style: trackContainerStyle,
            onClick: handleTrackClick,
            onMousedown: handleTrackMouseDown,
          }, [
            h('div', { style: trackStyle }),
            h('div', { style: fillStyle }),
            h('div', { style: thumbStyle }),
          ]),

          // Min/max labels
          h('div', { style: minMaxRowStyle }, [
            h('span', {}, String(min.value)),
            h('span', {}, String(max.value)),
          ]),

          // Footer actions
          h('div', { style: footerStyle }, [
            h('button', {
              type: 'button',
              style: actionBtnStyle,
              onClick: props.onCancel,
              tabindex: -1,
            }, 'Cancel'),
            h('button', {
              type: 'button',
              style: { ...actionBtnStyle, background: 'var(--ogrid-accent, #0078d4)', color: '#fff' },
              onClick: props.onCommit,
              tabindex: -1,
            }, 'Apply'),
          ]),
        ]
      );
    };
  },
});
