import * as React from 'react';

export interface WindowedPlaceholderRowProps {
  /** 'loading' = data still fetching; 'error' = the covering block failed. */
  status: 'loading' | 'error';
  /** Absolute row index — drives the accessible label and the retry target. */
  rowIndex: number;
  /** Number of `<td>` columns a normal row spans, so the placeholder lines up. */
  colSpan: number;
  /** Fixed row height in px — must match other rows so scroll geometry holds. */
  rowHeight: number;
  /** Retry the failed block. Only used when status is 'error'. */
  onRetry?: () => void;
}

const cellStyle: React.CSSProperties = {
  padding: '0 12px',
  color: 'var(--ogrid-muted, #8a8a8a)',
  fontSize: 13,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const skeletonStyle: React.CSSProperties = {
  display: 'inline-block',
  height: 10,
  width: '40%',
  maxWidth: 240,
  borderRadius: 3,
  background: 'var(--ogrid-skeleton-bg, rgba(0, 0, 0, 0.08))',
  verticalAlign: 'middle',
};

const retryButtonStyle: React.CSSProperties = {
  marginLeft: 8,
  padding: '2px 8px',
  font: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
  color: 'var(--ogrid-accent, #217346)',
  background: 'transparent',
  border: '1px solid var(--ogrid-border, #d0d0d0)',
  borderRadius: 4,
};

/**
 * A body-row stand-in for a windowed (lazy) data source: rendered for a row
 * whose data has not arrived yet ('loading') or whose block failed to fetch
 * ('error'). Kept at exactly `rowHeight` so the virtual-scroll geometry — which
 * assumes uniform row heights — stays correct while data streams in.
 *
 * Shared by all React UI packages so loading/error rows look and behave the
 * same across Radix, Fluent, and Material.
 */
export function WindowedPlaceholderRow({
  status,
  rowIndex,
  colSpan,
  rowHeight,
  onRetry,
}: WindowedPlaceholderRowProps): React.ReactElement {
  return (
    <tr
      style={{ height: rowHeight }}
      data-windowed-row={status}
      aria-hidden={status === 'loading' || undefined}
    >
      <td colSpan={colSpan} style={cellStyle}>
        {status === 'error' ? (
          <>
            <span role="alert">Couldn&rsquo;t load row {rowIndex + 1}.</span>
            {onRetry && (
              <button type="button" style={retryButtonStyle} onClick={onRetry}>
                Retry
              </button>
            )}
          </>
        ) : (
          <span style={skeletonStyle} role="status" aria-label={`Loading row ${rowIndex + 1}`} />
        )}
      </td>
    </tr>
  );
}
