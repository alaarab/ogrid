/**
 * StatusBar component — Shows row counts and aggregations at the bottom of the data grid.
 * Displays filteredCount, totalCount, and optional aggregations (sum, avg, min, max, count).
 */
import { defineComponent, h, type PropType } from 'vue';
import { getStatusBarParts, type StatusBarPart } from '@alaarab/ogrid-core';

export interface StatusBarProps {
  totalCount: number;
  filteredCount?: number;
  selectedCount?: number;
  selectedCellCount?: number;
  aggregation?: {
    sum: number;
    avg: number;
    min: number;
    max: number;
    count: number;
  } | null;
  suppressRowCount?: boolean;
}

export const StatusBar = defineComponent({
  name: 'StatusBar',
  props: {
    totalCount: { type: Number, required: true },
    filteredCount: { type: Number, default: undefined },
    selectedCount: { type: Number, default: undefined },
    selectedCellCount: { type: Number, default: undefined },
    aggregation: { type: Object as PropType<StatusBarProps['aggregation']>, default: undefined },
    suppressRowCount: { type: Boolean, default: false },
  },
  setup(props) {
    return () => {
      const parts: StatusBarPart[] = getStatusBarParts(props);
      return h('div', {
        role: 'status',
        'aria-live': 'polite',
        style: {
          marginTop: 'auto',
          padding: '6px 12px',
          borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
          backgroundColor: 'var(--ogrid-header-bg, rgba(0,0,0,0.04))',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '0.875rem',
        },
      }, parts.map((p, i) =>
        h('span', {
          key: p.key,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            ...(i < parts.length - 1
              ? { marginRight: '16px', borderRight: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))', paddingRight: '16px' }
              : {}),
          },
        }, [
          h('span', { style: { color: 'var(--ogrid-fg-secondary, rgba(0,0,0,0.6))' } }, p.label),
          h('span', { style: { fontWeight: '600' } }, p.value.toLocaleString()),
        ])
      ));
    };
  },
});
