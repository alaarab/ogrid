import * as React from 'react';

export interface BaseEmptyStateClassNames {
  emptyStateInGrid?: string;
  emptyStateInGridInner?: string;
  emptyStateInGridIcon?: string;
  emptyStateInGridTitle?: string;
  emptyStateInGridMessage?: string;
  emptyStateInGridLink?: string;
}

export interface BaseEmptyStateProps {
  emptyState: {
    render?: () => React.ReactNode;
    message?: React.ReactNode;
    hasActiveFilters?: boolean;
    onClearAll?: () => void;
  };
  classNames: BaseEmptyStateClassNames;
  /** Optional icon rendered above the title (e.g. emoji or SVG) */
  icon?: React.ReactNode;
}

export function BaseEmptyState({ emptyState, classNames, icon }: BaseEmptyStateProps): React.ReactElement {
  return (
    <div className={classNames.emptyStateInGrid}>
      <div className={classNames.emptyStateInGridInner}>
        {emptyState.render ? (
          emptyState.render()
        ) : (
          <>
            {icon != null && (
              <span className={classNames.emptyStateInGridIcon} aria-hidden>
                {icon}
              </span>
            )}
            <div className={classNames.emptyStateInGridTitle}>No results found</div>
            <div className={classNames.emptyStateInGridMessage}>
              {emptyState.message != null ? (
                emptyState.message
              ) : emptyState.hasActiveFilters ? (
                <>
                  No items match your current filters. Try adjusting your search or{' '}
                  <button type="button" className={classNames.emptyStateInGridLink} onClick={emptyState.onClearAll}>
                    clear all filters
                  </button>{' '}
                  to see all items.
                </>
              ) : (
                'There are no items available at this time.'
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
