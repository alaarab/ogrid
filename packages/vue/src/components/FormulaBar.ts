/**
 * FormulaBar — Headless Excel-style formula bar component.
 *
 * Layout: [Name Box] [fx] [Formula Input]
 *
 * Uses --ogrid-* CSS variables for theming.
 */

import { defineComponent, h, ref, watch, type PropType } from 'vue';

const barStyle = {
  display: 'flex',
  alignItems: 'center',
  borderBottom: '1px solid var(--ogrid-border, #e0e0e0)',
  background: 'var(--ogrid-bg, #fff)',
  minHeight: '28px',
  fontSize: '13px',
};

const nameBoxStyle = {
  fontFamily: 'monospace',
  fontSize: '12px',
  fontWeight: '500',
  padding: '2px 8px',
  borderRight: '1px solid var(--ogrid-border, #e0e0e0)',
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
  minWidth: '52px',
  textAlign: 'center' as const,
  lineHeight: '24px',
  userSelect: 'none' as const,
  whiteSpace: 'nowrap' as const,
};

const fxLabelStyle = {
  padding: '2px 8px',
  fontStyle: 'italic',
  fontWeight: '600',
  color: 'var(--ogrid-muted-fg, #888)',
  userSelect: 'none' as const,
  borderRight: '1px solid var(--ogrid-border, #e0e0e0)',
  lineHeight: '24px',
  fontSize: '12px',
};

const inputStyle = {
  flex: '1',
  border: 'none',
  outline: 'none',
  padding: '2px 8px',
  fontFamily: 'monospace',
  fontSize: '12px',
  lineHeight: '24px',
  background: 'transparent',
  color: 'var(--ogrid-fg, #242424)',
  minWidth: '0',
};

export interface FormulaBarProps {
  /** Active cell reference (e.g. "A1"). */
  cellRef: string | null;
  /** Text displayed/edited in the formula input. */
  formulaText: string;
  /** Whether the input is in editing mode. */
  isEditing: boolean;
}

export const FormulaBar = defineComponent({
  name: 'FormulaBar',
  props: {
    cellRef: { type: [String, null] as PropType<string | null>, default: null },
    formulaText: { type: String, required: true },
    isEditing: { type: Boolean, required: true },
  },
  emits: ['inputChange', 'commit', 'cancel', 'startEditing'],
  setup(props, { emit }) {
    const inputRef = ref<HTMLInputElement | null>(null);

    // Focus input when entering edit mode
    watch(() => props.isEditing, (editing) => {
      if (editing && inputRef.value) {
        inputRef.value.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        emit('commit');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        emit('cancel');
      }
    };

    const handleInput = (e: Event) => {
      emit('inputChange', (e.target as HTMLInputElement).value);
    };

    const handleClick = () => {
      if (!props.isEditing) emit('startEditing');
    };

    return () =>
      h('div', { style: barStyle, role: 'toolbar', 'aria-label': 'Formula bar' }, [
        h('div', { style: nameBoxStyle, 'aria-label': 'Active cell reference' },
          props.cellRef ?? '\u2014'
        ),
        h('div', { style: fxLabelStyle, 'aria-hidden': 'true' }, 'fx'),
        h('input', {
          ref: inputRef,
          type: 'text',
          style: inputStyle,
          value: props.formulaText,
          readonly: !props.isEditing,
          onInput: handleInput,
          onKeydown: handleKeyDown,
          onClick: handleClick,
          onDblclick: handleClick,
          'aria-label': 'Formula input',
          spellcheck: false,
          autocomplete: 'off',
        }),
      ]);
  },
});
