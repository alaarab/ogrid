import * as React from 'react';
import { Box, useTheme } from '@mui/material';
import { createOGrid } from '@alaarab/ogrid-react';
import { DataGridTable } from '../DataGridTable/DataGridTable';
import { ColumnChooser } from '../ColumnChooser/ColumnChooser';
import { PaginationControls } from '../PaginationControls/PaginationControls';

export type { IOGridProps } from '@alaarab/ogrid-react';

/**
 * MUI theme bridge: reads the MUI palette and sets --ogrid-* CSS variables
 * so the shared OGridLayout and DataGridTable styles adapt to the MUI theme.
 */
const MuiThemeContainer = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<'div'>>(
  function MuiThemeContainer(props, ref) {
    const theme = useTheme();
    const sx = React.useMemo(() => ({
      display: 'flex', flexDirection: 'column', gap: 1,
      '--ogrid-bg': theme.palette.background.default,
      '--ogrid-border': theme.palette.divider,
      '--ogrid-header-bg': theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100],
      '--ogrid-fg': theme.palette.text.primary,
      '--ogrid-fg-secondary': theme.palette.text.secondary,
      '--ogrid-fg-muted': theme.palette.text.disabled,
      '--ogrid-hover-bg': theme.palette.action.hover,
    }), [theme]);

    return <Box ref={ref} sx={sx} {...props} />;
  }
);

export const OGrid = createOGrid({
  DataGridTable: DataGridTable as never,
  ColumnChooser: ColumnChooser as never,
  PaginationControls,
  containerComponent: MuiThemeContainer,
});
