import * as React from 'react';
import styles from './DataGridTable.module.scss';

interface EmptyStateProps {
  emptyState: {
    render?: () => React.ReactNode;
    message?: React.ReactNode;
    hasActiveFilters?: boolean;
    onClearAll?: () => void;
  };
}

export function EmptyState({ emptyState }: EmptyStateProps): React.ReactElement {
  return (
    <div className={styles.emptyStateInGrid}>
      <div className={styles.emptyStateInGridMessageSticky}>
        {emptyState.render ? (
          emptyState.render()
        ) : (
          <>
            <span className={styles.emptyStateInGridIcon} aria-hidden>
              {'\uD83D\uDCCB'}
            </span>
            <div className={styles.emptyStateInGridTitle}>No results found</div>
            <div className={styles.emptyStateInGridMessage}>
              {emptyState.message != null ? (
                emptyState.message
              ) : emptyState.hasActiveFilters ? (
                <>
                  No items match your current filters. Try adjusting your search or{' '}
                  <button type="button" className={styles.emptyStateInGridLink} onClick={emptyState.onClearAll}>
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
