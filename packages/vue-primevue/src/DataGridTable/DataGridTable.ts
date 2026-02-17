import { h } from 'vue';
import Checkbox from 'primevue/checkbox';
import ProgressSpinner from 'primevue/progressspinner';
import { createDataGridTable } from '@alaarab/ogrid-vue';
import { ColumnHeaderFilter } from '../ColumnHeaderFilter';
import { ColumnHeaderMenu } from '../ColumnHeaderMenu/ColumnHeaderMenu';
import { InlineCellEditor } from './InlineCellEditor';
import { GridContextMenu } from './GridContextMenu';
import { renderEmptyState } from './EmptyState';
import './DataGridTable.css';

export const DataGridTable = createDataGridTable({
  renderCheckbox: ({ modelValue, indeterminate, ariaLabel, onChange }) =>
    h(Checkbox, {
      modelValue,
      binary: true,
      indeterminate,
      'aria-label': ariaLabel,
      'onUpdate:modelValue': (c: boolean) => onChange(!!c),
    }),
  renderSpinner: (message) =>
    h('div', { class: 'ogrid-loading-inner' }, [
      h(ProgressSpinner, { style: { width: '24px', height: '24px' } }),
      h('span', { class: 'ogrid-loading-message' }, message),
    ]),
  ColumnHeaderFilter,
  ColumnHeaderMenu,
  InlineCellEditor,
  GridContextMenu,
  renderEmptyState: (emptyState) => renderEmptyState({ emptyState }),
});
