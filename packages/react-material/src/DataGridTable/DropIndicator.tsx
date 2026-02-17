import * as React from 'react';
import { Box } from '@mui/material';

interface DropIndicatorProps {
  dropIndicatorX: number;
  wrapperLeft: number;
}

export function DropIndicator({ dropIndicatorX, wrapperLeft }: DropIndicatorProps): React.ReactElement {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 3,
        bgcolor: 'var(--ogrid-primary, #217346)',
        pointerEvents: 'none',
        zIndex: 100,
        transition: 'left 0.05s',
        left: dropIndicatorX - wrapperLeft,
      }}
    />
  );
}
