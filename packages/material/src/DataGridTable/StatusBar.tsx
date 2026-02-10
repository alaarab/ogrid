import * as React from 'react';
import { Box, Typography } from '@mui/material';
import { getStatusBarParts } from '@alaarab/ogrid-core';

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

const partSx = (isLast: boolean) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  ...(isLast ? {} : { mr: 2, '&::after': { content: '"|"', ml: 2, color: 'divider' } }),
});

export function StatusBar(props: StatusBarProps): React.ReactElement {
  const parts = getStatusBarParts(props);
  return (
    <Box role="status" aria-live="polite" sx={{ mt: 'auto', px: 1.5, py: 0.75, borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
      {parts.map((p, i) => (
        <Typography key={p.key} component="span" variant="body2" sx={partSx(i === parts.length - 1)}>
          <Typography component="span" color="text.secondary">{p.label}</Typography>
          <Typography component="span" fontWeight={600}>{p.value.toLocaleString()}</Typography>
        </Typography>
      ))}
    </Box>
  );
}
