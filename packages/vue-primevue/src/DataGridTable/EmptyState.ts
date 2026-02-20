import { h, type VNode, type Component } from 'vue';
import Button from 'primevue/button';

interface EmptyStateProps {
  emptyState: {
    render?: () => unknown;
    message?: string | null;
    hasActiveFilters?: boolean;
    onClearAll?: () => void;
  };
}

export function renderEmptyState({ emptyState }: EmptyStateProps): VNode {
  return h('div', { class: 'ogrid-empty-state' },
    emptyState.render
      ? [emptyState.render() as string]
      : [
          h('div', { class: 'ogrid-empty-state-title' }, 'No results found'),
          h('div', { class: 'ogrid-empty-state-message' },
            emptyState.message != null
              ? String(emptyState.message)
              : emptyState.hasActiveFilters
                ? [
                    'No items match your current filters. Try adjusting your search or ',
                    h(Button as Component, {
                      text: true,
                      size: 'small',
                      onClick: emptyState.onClearAll,
                    }, () => 'clear all filters'),
                    ' to see all items.',
                  ]
                : 'There are no items available at this time.'
          ),
        ]
  );
}
