import { h } from 'vue';
import { createDataGridTable } from '@alaarab/ogrid-vue';
import ColumnHeaderFilter from '../ColumnHeaderFilter/ColumnHeaderFilter.vue';
import ColumnHeaderMenu from '../ColumnHeaderMenu/ColumnHeaderMenu.vue';
import { InlineCellEditor } from './InlineCellEditor';
import GridContextMenu from './GridContextMenu.vue';
import { renderEmptyState } from './EmptyState';
import './DataGridTable.css';

export const DataGridTable = createDataGridTable({
  renderCheckbox: ({ modelValue, indeterminate, ariaLabel, onChange }) =>
    h('label', { class: 'ogrid-checkbox-label' }, [
      h('input', {
        type: 'checkbox',
        checked: modelValue,
        'aria-label': ariaLabel,
        class: 'ogrid-checkbox',
        ref: (el: unknown) => {
          if (el) (el as HTMLInputElement).indeterminate = !!indeterminate;
        },
        onChange: (e: Event) => onChange((e.target as HTMLInputElement).checked),
      }),
    ]),
  renderSpinner: (message) =>
    h('div', { class: 'ogrid-loading-inner' }, [
      h('div', { class: 'ogrid-loading-spinner' }),
      h('span', { class: 'ogrid-loading-message' }, message),
    ]),
  ColumnHeaderFilter,
  ColumnHeaderMenu,
  InlineCellEditor,
  GridContextMenu,
  renderEmptyState: (emptyState) => renderEmptyState({ emptyState }),
});

export default DataGridTable;
