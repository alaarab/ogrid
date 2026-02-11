import * as React from 'react';

const clearButtonStyle: React.CSSProperties = { background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' };

/**
 * Props for the EmptyState component.
 * Used to render "No results found" messages in DataGridTable.
 */
export interface EmptyStateProps {
  /** Custom message override */
  message?: React.ReactNode;
  /** Whether filters are currently active */
  hasActiveFilters?: boolean;
  /** Called when user clicks "clear all filters" link */
  onClearAll?: () => void;
  /** Custom render function (overrides default rendering) */
  render?: () => React.ReactNode;
}

/**
 * Headless empty state component with default rendering logic.
 * Framework-specific wrappers provide styling.
 *
 * Default behavior:
 * - Shows "No results found" title
 * - If hasActiveFilters=true: shows "clear all filters" link
 * - If message provided: shows custom message
 * - If render provided: uses custom renderer
 */
export function EmptyState(props: EmptyStateProps): React.ReactElement {
  const { message, hasActiveFilters, onClearAll, render } = props;

  if (render) {
    return <>{render()}</>;
  }

  return (
    <>
      {message != null ? (
        message
      ) : hasActiveFilters ? (
        <>
          No items match your current filters. Try adjusting your search or{' '}
          <button type="button" onClick={onClearAll} style={clearButtonStyle}>
            clear all filters
          </button>{' '}
          to see all items.
        </>
      ) : (
        'There are no items available at this time.'
      )}
    </>
  );
}
