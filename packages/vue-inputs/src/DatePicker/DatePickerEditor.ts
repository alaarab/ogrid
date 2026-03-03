/**
 * DatePickerEditor — Premium calendar-based date picker for OGrid (Vue).
 *
 * Usage:
 *   import { DatePickerEditor } from '@alaarab/ogrid-vue-inputs';
 *
 *   const columns = [{
 *     columnId: 'dueDate',
 *     cellEditor: DatePickerEditor,
 *     cellEditorPopup: true,
 *   }];
 *
 * Implements ICellEditorProps<T> — works with cellEditorPopup: true.
 */
import { defineComponent, ref, computed, onMounted, h, type PropType, type CSSProperties } from 'vue';
import type { IColumnDef } from '@alaarab/ogrid-core';
import { getCalendarGrid, formatDate, parseDate, DAY_NAMES, MONTH_NAMES } from '@alaarab/ogrid-inputs';

// ── Styles (inline to avoid CSS file dependency — keeps package sideEffects: false) ──

const rootStyle: CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '13px',
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  borderRadius: '8px',
  boxShadow: 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.15))',
  padding: '12px',
  width: '280px',
  userSelect: 'none',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '8px',
};

const headerBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '14px',
  color: 'inherit',
  lineHeight: '1',
};

const headerTitleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: '14px',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '1px',
  textAlign: 'center',
};

const dayHeaderStyle: CSSProperties = {
  padding: '4px 0',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--ogrid-muted, #888)',
};

const baseCellStyle: CSSProperties = {
  padding: '6px 0',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '13px',
  lineHeight: '1',
  border: 'none',
  background: 'none',
  color: 'inherit',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '8px',
  paddingTop: '8px',
  borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
};

const footerBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  color: 'var(--ogrid-accent, #0078d4)',
  fontWeight: 500,
};

const inputRowStyle: CSSProperties = {
  display: 'flex',
  gap: '6px',
  marginBottom: '8px',
};

const inputStyle: CSSProperties = {
  flex: '1',
  padding: '4px 8px',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
  borderRadius: '4px',
  fontSize: '13px',
  outline: 'none',
  background: 'var(--ogrid-bg, #fff)',
  color: 'inherit',
};

// ── Component ──

export const DatePickerEditor = defineComponent({
  name: 'DatePickerEditor',
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
    // Parse initial value
    const initial = (() => {
      if (props.value == null) return null;
      return parseDate(String(props.value));
    })();

    const today = new Date();
    const viewYear = ref(initial?.year ?? today.getFullYear());
    const viewMonth = ref(initial?.month ?? today.getMonth());
    const selectedDate = ref(initial ? formatDate(initial.year, initial.month, initial.date) : '');
    const inputText = ref(selectedDate.value);
    const hoveredCell = ref<string | null>(null);
    const rootEl = ref<HTMLDivElement | null>(null);

    const grid = computed(() => getCalendarGrid(viewYear.value, viewMonth.value));

    const prevMonth = () => {
      if (viewMonth.value === 0) {
        viewMonth.value = 11;
        viewYear.value -= 1;
      } else {
        viewMonth.value -= 1;
      }
    };

    const nextMonth = () => {
      if (viewMonth.value === 11) {
        viewMonth.value = 0;
        viewYear.value += 1;
      } else {
        viewMonth.value += 1;
      }
    };

    const selectDay = (year: number, month: number, date: number) => {
      const formatted = formatDate(year, month, date);
      selectedDate.value = formatted;
      inputText.value = formatted;
      props.onValueChange(formatted);
      // Auto-commit on date selection
      setTimeout(() => props.onCommit(), 0);
    };

    const handleInputChange = (e: Event) => {
      const text = (e.target as HTMLInputElement).value;
      inputText.value = text;
      const parsed = parseDate(text);
      if (parsed) {
        selectedDate.value = formatDate(parsed.year, parsed.month, parsed.date);
        viewYear.value = parsed.year;
        viewMonth.value = parsed.month;
        props.onValueChange(text);
      }
    };

    const handleInputKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        props.onValueChange(inputText.value);
        props.onCommit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        props.onCancel();
      }
    };

    const handleToday = () => {
      const t = new Date();
      selectDay(t.getFullYear(), t.getMonth(), t.getDate());
    };

    const handleClear = () => {
      selectedDate.value = '';
      inputText.value = '';
      props.onValueChange('');
      props.onCommit();
    };

    // Focus the input on mount
    onMounted(() => {
      const input = rootEl.value?.querySelector('input');
      if (input) {
        input.focus();
        input.select();
      }
    });

    // Return render function
    return () => {
      const dayHeaders = DAY_NAMES.map((d) =>
        h('div', { key: d, style: dayHeaderStyle }, d)
      );

      const dateCells = grid.value.flat().map((day) => {
        const key = formatDate(day.year, day.month, day.date);
        const isSelected = key === selectedDate.value;
        const isHovered = key === hoveredCell.value;

        const cellStyle: CSSProperties = { ...baseCellStyle };

        if (!day.isCurrentMonth) {
          cellStyle.color = 'var(--ogrid-muted, #ccc)';
        }
        if (day.isToday && !isSelected) {
          cellStyle.fontWeight = 700;
          cellStyle.color = 'var(--ogrid-accent, #0078d4)';
        }
        if (isSelected) {
          cellStyle.background = 'var(--ogrid-accent, #0078d4)';
          cellStyle.color = '#fff';
          cellStyle.fontWeight = 600;
        } else if (isHovered) {
          cellStyle.background = 'var(--ogrid-bg-hover, #f0f0f0)';
        }

        return h(
          'button',
          {
            key,
            type: 'button',
            style: cellStyle,
            onClick: () => selectDay(day.year, day.month, day.date),
            onMouseenter: () => { hoveredCell.value = key; },
            onMouseleave: () => { hoveredCell.value = null; },
            tabindex: -1,
          },
          day.date
        );
      });

      return h(
        'div',
        {
          ref: rootEl,
          style: rootStyle,
          onMousedown: (e: MouseEvent) => e.stopPropagation(),
        },
        [
          // Text input row
          h('div', { style: inputRowStyle }, [
            h('input', {
              type: 'text',
              value: inputText.value,
              onInput: handleInputChange,
              onKeydown: handleInputKeyDown,
              placeholder: 'YYYY-MM-DD',
              style: inputStyle,
            }),
          ]),

          // Month/year header
          h('div', { style: headerStyle }, [
            h(
              'button',
              {
                type: 'button',
                style: headerBtnStyle,
                onClick: prevMonth,
                'aria-label': 'Previous month',
              },
              '\u2039'
            ),
            h('span', { style: headerTitleStyle }, `${MONTH_NAMES[viewMonth.value]} ${viewYear.value}`),
            h(
              'button',
              {
                type: 'button',
                style: headerBtnStyle,
                onClick: nextMonth,
                'aria-label': 'Next month',
              },
              '\u203A'
            ),
          ]),

          // Calendar grid
          h('div', { style: gridStyle }, [...dayHeaders, ...dateCells]),

          // Footer
          h('div', { style: footerStyle }, [
            h(
              'button',
              { type: 'button', style: footerBtnStyle, onClick: handleToday },
              'Today'
            ),
            h(
              'button',
              { type: 'button', style: footerBtnStyle, onClick: handleClear },
              'Clear'
            ),
          ]),
        ]
      );
    };
  },
});
