/**
 * ColorPickerEditor  -  Premium color swatch picker with hex input for OGrid (Vue).
 *
 * Usage:
 *   import { ColorPickerEditor } from '@alaarab/ogrid-vue-inputs';
 *
 *   const columns = [{
 *     columnId: 'color',
 *     cellEditor: ColorPickerEditor,
 *     cellEditorPopup: true,
 *     cellEditorParams: { allowCustom: true },
 *   }];
 *
 * Implements ICellEditorProps<T>  -  works with cellEditorPopup: true.
 */
import { defineComponent, ref, computed, onMounted, h, type PropType, type CSSProperties } from 'vue';
import type { IColumnDef } from '@alaarab/ogrid-core';
import {
  DEFAULT_COLOR_PALETTE,
  isValidHex,
  normalizeHex,
  isLightColor,
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
  width: '200px',
};

const swatchGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: '6px',
  marginBottom: '10px',
};

const hexRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  paddingTop: '8px',
  borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
};

const hexPreviewStyle: CSSProperties = {
  width: '24px',
  height: '24px',
  borderRadius: '4px',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  flexShrink: 0,
};

const hexInputStyle: CSSProperties = {
  flex: '1',
  padding: '4px 8px',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
  borderRadius: '4px',
  fontSize: '13px',
  outline: 'none',
  background: 'var(--ogrid-bg, #fff)',
  color: 'inherit',
  fontFamily: 'monospace',
  minWidth: 0,
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
  whiteSpace: 'nowrap',
};

// ── Component ──

export const ColorPickerEditor = defineComponent({
  name: 'ColorPickerEditor',
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
    const palette = computed<readonly string[]>(() =>
      (props.cellEditorParams?.colors as string[] | undefined) ?? DEFAULT_COLOR_PALETTE
    );
    const allowCustom = computed<boolean>(
      () => (props.cellEditorParams?.allowCustom as boolean | undefined) ?? true
    );

    const parseInitialValue = (): string => {
      if (props.value == null) return '';
      const s = String(props.value).trim();
      return isValidHex(s) ? (normalizeHex(s) ?? s) : '';
    };

    const selectedColor = ref<string>(parseInitialValue());
    const hexInput = ref<string>(selectedColor.value);
    const hexInputEl = ref<HTMLInputElement | null>(null);
    const rootEl = ref<HTMLDivElement | null>(null);

    const isHexValid = computed<boolean>(() => hexInput.value === '' || isValidHex(hexInput.value));

    const selectColor = (color: string) => {
      const normalized = normalizeHex(color) ?? color;
      selectedColor.value = normalized;
      hexInput.value = normalized;
      props.onValueChange(normalized);
      setTimeout(() => props.onCommit(), 0);
    };

    const handleHexInput = (e: Event) => {
      const val = (e.target as HTMLInputElement).value;
      hexInput.value = val;
      if (isValidHex(val)) {
        const normalized = normalizeHex(val) ?? val;
        selectedColor.value = normalized;
        props.onValueChange(normalized);
      }
    };

    const handleHexKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (isValidHex(hexInput.value)) {
          const normalized = normalizeHex(hexInput.value) ?? hexInput.value;
          selectedColor.value = normalized;
          props.onValueChange(normalized);
        }
        props.onCommit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        props.onCancel();
      }
    };

    const handleClear = () => {
      selectedColor.value = '';
      hexInput.value = '';
      props.onValueChange('');
      props.onCommit();
    };

    onMounted(() => {
      if (allowCustom.value && hexInputEl.value) {
        hexInputEl.value.focus();
        hexInputEl.value.select();
      } else {
        rootEl.value?.focus();
      }
    });

    return () => {
      const swatches = palette.value.map((color, idx) => {
        const isSelected = selectedColor.value.toUpperCase() === color.toUpperCase();
        const swatchStyle: CSSProperties = {
          width: '100%',
          aspectRatio: '1',
          borderRadius: '4px',
          cursor: 'pointer',
          background: color,
          border: isSelected
            ? '2px solid var(--ogrid-fg, #242424)'
            : '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: isLightColor(color) ? '#000' : '#fff',
          position: 'relative',
          boxSizing: 'border-box',
          padding: 0,
          outline: 'none',
        };

        return h('button', {
          key: `${color}-${idx}`,
          type: 'button',
          style: swatchStyle,
          title: color,
          'aria-label': color,
          onClick: () => selectColor(color),
          tabindex: -1,
        }, isSelected ? '\u2713' : '');
      });

      const previewBg = selectedColor.value || 'transparent';

      return h(
        'div',
        {
          ref: rootEl,
          style: rootStyle,
          tabindex: 0,
          onMousedown: (e: MouseEvent) => e.stopPropagation(),
        },
        [
          h('div', { style: swatchGridStyle }, swatches),

          allowCustom.value
            ? h('div', { style: hexRowStyle }, [
                h('div', {
                  style: {
                    ...hexPreviewStyle,
                    background: previewBg,
                  },
                }),
                h('input', {
                  ref: hexInputEl,
                  type: 'text',
                  value: hexInput.value,
                  onInput: handleHexInput,
                  onKeydown: handleHexKeyDown,
                  placeholder: '#RRGGBB',
                  maxlength: 9,
                  style: {
                    ...hexInputStyle,
                    borderColor: isHexValid.value
                      ? 'var(--ogrid-border, rgba(0,0,0,0.2))'
                      : '#e53935',
                  },
                }),
                h('button', {
                  type: 'button',
                  style: clearBtnStyle,
                  onClick: handleClear,
                  tabindex: -1,
                }, 'Clear'),
              ])
            : h('div', { style: { ...hexRowStyle, justifyContent: 'flex-end' } }, [
                h('button', {
                  type: 'button',
                  style: clearBtnStyle,
                  onClick: handleClear,
                  tabindex: -1,
                }, 'Clear'),
              ]),
        ]
      );
    };
  },
});
