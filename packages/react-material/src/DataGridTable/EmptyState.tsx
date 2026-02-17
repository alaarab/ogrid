import * as React from 'react';
import { Box, Typography, Button } from '@mui/material';

const EMPTY_STATE_SX = { py: 4, px: 2, textAlign: 'center', borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover' } as const;

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
    <Box sx={EMPTY_STATE_SX}>
      {emptyState.render ? (
        emptyState.render()
      ) : (
        <>
          <Typography variant="h6" gutterBottom>No results found</Typography>
          <Typography variant="body2" color="text.secondary">
            {emptyState.message != null ? (
              emptyState.message
            ) : emptyState.hasActiveFilters ? (
              <>
                No items match your current filters. Try adjusting your search or{' '}
                <Button variant="text" size="small" onClick={emptyState.onClearAll}>clear all filters</Button>{' '}
                to see all items.
              </>
            ) : (
              'There are no items available at this time.'
            )}
          </Typography>
        </>
      )}
    </Box>
  );
}
