import * as React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const LOADING_OVERLAY_SX = {
  position: 'absolute', inset: 0, zIndex: 2,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--ogrid-loading-bg, rgba(255,255,255,0.7))',
} as const;
const LOADING_INNER_SX = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
  p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1,
} as const;

interface LoadingOverlayProps {
  message: string;
}

export function LoadingOverlay({ message }: LoadingOverlayProps): React.ReactElement {
  return (
    <Box sx={LOADING_OVERLAY_SX}>
      <Box sx={LOADING_INNER_SX}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">{message}</Typography>
      </Box>
    </Box>
  );
}
