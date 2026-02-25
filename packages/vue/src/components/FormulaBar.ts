/**
 * FormulaBar — Headless Excel-style formula bar component.
 *
 * Layout: [Name Box] [fx] [Formula Input]
 *
 * Uses --ogrid-* CSS variables for theming.
 */

import { defineComponent, h, ref, watch, type PropType } from 'vue';
import { FORMULA_BAR_STYLES, handleFormulaBarKeyDown } from '@alaarab/ogrid-core';

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

    return () =>
      h('div', { style: FORMULA_BAR_STYLES.bar, role: 'toolbar', 'aria-label': 'Formula bar' }, [
        h('div', { style: FORMULA_BAR_STYLES.nameBox, 'aria-label': 'Active cell reference' },
          props.cellRef ?? '\u2014'
        ),
        h('div', { style: FORMULA_BAR_STYLES.fxLabel, 'aria-hidden': 'true' }, 'fx'),
        h('input', {
          ref: inputRef,
          type: 'text',
          style: FORMULA_BAR_STYLES.input,
          value: props.formulaText,
          readonly: !props.isEditing,
          onInput: (e: Event) => emit('inputChange', (e.target as HTMLInputElement).value),
          onKeydown: (e: KeyboardEvent) => handleFormulaBarKeyDown(e.key, () => e.preventDefault(), () => emit('commit'), () => emit('cancel')),
          onClick: () => { if (!props.isEditing) emit('startEditing'); },
          onDblclick: () => { if (!props.isEditing) emit('startEditing'); },
          'aria-label': 'Formula input',
          spellcheck: false,
          autocomplete: 'off',
        }),
      ]);
  },
});
