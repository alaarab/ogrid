import { defineComponent, computed, h, type PropType } from 'vue';
import Button from 'primevue/button';
import Select from 'primevue/select';
import { getPaginationViewModel } from '@alaarab/ogrid-vue';

export interface IPaginationControlsProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  entityLabelPlural?: string;
}

export const PaginationControls = defineComponent({
  name: 'PaginationControls',
  props: {
    currentPage: { type: Number, required: true },
    pageSize: { type: Number, required: true },
    totalCount: { type: Number, required: true },
    onPageChange: { type: Function as PropType<(page: number) => void>, required: true },
    onPageSizeChange: { type: Function as PropType<(pageSize: number) => void>, required: true },
    pageSizeOptions: { type: Array as PropType<number[]>, default: undefined },
    entityLabelPlural: { type: String, default: 'items' },
  },
  setup(props) {
    const vm = computed(() =>
      getPaginationViewModel(
        props.currentPage,
        props.pageSize,
        props.totalCount,
        props.pageSizeOptions ? { pageSizeOptions: props.pageSizeOptions } : undefined
      )
    );

    return () => {
      const v = vm.value;
      if (!v) return null;

      const { pageNumbers, showStartEllipsis, showEndEllipsis, totalPages, startItem, endItem } = v;
      const label = props.entityLabelPlural ?? 'items';

      return h('div', {
        role: 'navigation',
        'aria-label': 'Pagination',
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '0 12px',
          width: '100%',
          minWidth: '0',
          boxSizing: 'border-box',
        },
      }, [
        // Summary text
        h('span', {
          style: { fontSize: '0.875rem', color: 'var(--ogrid-fg-secondary, rgba(0,0,0,0.6))' },
        }, `Showing ${startItem} to ${endItem} of ${props.totalCount.toLocaleString()} ${label}`),

        // Page buttons
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [
          // First page
          h(Button, {
            icon: 'pi pi-angle-double-left',
            size: 'small',
            text: true,
            rounded: true,
            disabled: props.currentPage === 1,
            'aria-label': 'First page',
            onClick: () => props.onPageChange(1),
          }),
          // Previous
          h(Button, {
            icon: 'pi pi-angle-left',
            size: 'small',
            text: true,
            rounded: true,
            disabled: props.currentPage === 1,
            'aria-label': 'Previous page',
            onClick: () => props.onPageChange(props.currentPage - 1),
          }),

          // Start ellipsis
          ...(showStartEllipsis ? [
            h(Button, {
              size: 'small',
              outlined: true,
              'aria-label': 'Page 1',
              style: { minWidth: '32px' },
              onClick: () => props.onPageChange(1),
            }, () => '1'),
            h('span', { style: { margin: '0 4px', color: 'var(--ogrid-fg-secondary, rgba(0,0,0,0.6))' }, 'aria-hidden': 'true' }, '\u2026'),
          ] : []),

          // Page numbers
          ...pageNumbers.map((pageNum) =>
            h(Button, {
              key: pageNum,
              size: 'small',
              outlined: props.currentPage !== pageNum,
              severity: props.currentPage === pageNum ? undefined : 'secondary',
              'aria-label': `Page ${pageNum}`,
              'aria-current': props.currentPage === pageNum ? 'page' : undefined,
              style: { minWidth: '32px' },
              onClick: () => props.onPageChange(pageNum),
            }, () => String(pageNum))
          ),

          // End ellipsis
          ...(showEndEllipsis ? [
            h('span', { style: { margin: '0 4px', color: 'var(--ogrid-fg-secondary, rgba(0,0,0,0.6))' }, 'aria-hidden': 'true' }, '\u2026'),
            h(Button, {
              size: 'small',
              outlined: true,
              'aria-label': `Page ${totalPages}`,
              style: { minWidth: '32px' },
              onClick: () => props.onPageChange(totalPages),
            }, () => String(totalPages)),
          ] : []),

          // Next
          h(Button, {
            icon: 'pi pi-angle-right',
            size: 'small',
            text: true,
            rounded: true,
            disabled: props.currentPage >= totalPages,
            'aria-label': 'Next page',
            onClick: () => props.onPageChange(props.currentPage + 1),
          }),
          // Last page
          h(Button, {
            icon: 'pi pi-angle-double-right',
            size: 'small',
            text: true,
            rounded: true,
            disabled: props.currentPage >= totalPages,
            'aria-label': 'Last page',
            onClick: () => props.onPageChange(totalPages),
          }),
        ]),

        // Page size selector
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
          h('span', { style: { fontSize: '0.875rem', color: 'var(--ogrid-fg-secondary, rgba(0,0,0,0.6))' } }, 'Rows'),
          h(Select as any, {
            modelValue: props.pageSize,
            options: v.pageSizeOptions,
            'aria-label': 'Rows per page',
            style: { minWidth: '70px', maxWidth: '90px' },
            'onUpdate:modelValue': (val: number) => props.onPageSizeChange(Number(val)),
          }),
        ]),
      ]);
    };
  },
});
