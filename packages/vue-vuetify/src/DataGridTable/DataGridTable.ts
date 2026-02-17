import { h } from 'vue';
import { VCheckbox, VProgressCircular } from 'vuetify/components';
import { createDataGridTable } from '@alaarab/ogrid-vue';
import { ColumnHeaderFilter } from '../ColumnHeaderFilter';
import { ColumnHeaderMenu } from '../ColumnHeaderMenu/ColumnHeaderMenu';
import { InlineCellEditor } from './InlineCellEditor';
import { GridContextMenu } from './GridContextMenu';
import { renderEmptyState } from './EmptyState';
import './DataGridTable.css';

export const DataGridTable = createDataGridTable({
  renderCheckbox: ({ modelValue, indeterminate, ariaLabel, onChange }) =>
    h(VCheckbox as any, {
      modelValue,
      indeterminate,
      hideDetails: true,
      density: 'compact',
      'aria-label': ariaLabel,
      'onUpdate:modelValue': (c: boolean) => onChange(!!c),
    }),
  renderSpinner: (message) =>
    h('div', { class: 'ogrid-loading-inner' }, [
      h(VProgressCircular as any, { size: 24, indeterminate: true }),
      h('span', { class: 'ogrid-loading-message' }, message),
    ]),
  ColumnHeaderFilter,
  ColumnHeaderMenu,
  InlineCellEditor,
  GridContextMenu,
  renderEmptyState: (emptyState) => renderEmptyState({ emptyState }),
});
