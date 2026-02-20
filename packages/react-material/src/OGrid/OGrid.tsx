import * as React from 'react';
import { forwardRef } from 'react';
import { Box, useTheme } from '@mui/material';
import { DataGridTable } from '../DataGridTable/DataGridTable';
import type { IOGridDataGridProps } from '@alaarab/ogrid-react';
import { ColumnChooser } from '../ColumnChooser/ColumnChooser';
import { PaginationControls } from '../PaginationControls/PaginationControls';
import {
  useOGrid,
  OGridLayout,
  type IOGridProps,
  type IOGridApi,
} from '@alaarab/ogrid-react';

export type { IOGridProps } from '@alaarab/ogrid-react';

const OGridInner = forwardRef(function OGridInner<T>(
  props: IOGridProps<T>,
  ref: React.Ref<IOGridApi<T>>
): React.ReactElement {
  const { dataGridProps, pagination, columnChooser, layout } = useOGrid(props, ref);
  const theme = useTheme();

  // Set --ogrid-* CSS variables so the shared OGridLayout adapts to MUI theme (both modes)
  const containerSx = React.useMemo(() => ({
    display: 'flex', flexDirection: 'column', gap: 1,
    '--ogrid-bg': theme.palette.background.default,
    '--ogrid-border': theme.palette.divider,
    '--ogrid-header-bg': theme.palette.action.hover,
    '--ogrid-fg': theme.palette.text.primary,
    '--ogrid-fg-secondary': theme.palette.text.secondary,
    '--ogrid-fg-muted': theme.palette.text.disabled,
    '--ogrid-hover-bg': theme.palette.action.hover,
  }), [theme]);

  return (
    <OGridLayout
      containerComponent={Box}
      containerProps={{ sx: containerSx }}
      className={layout.className}
      sideBar={layout.sideBarProps}
      toolbar={layout.toolbar}
      toolbarBelow={layout.toolbarBelow}
      fullScreen={layout.fullScreen}
      toolbarEnd={
        columnChooser.placement === 'toolbar' ? (
          <ColumnChooser
            columns={columnChooser.columns}
            visibleColumns={columnChooser.visibleColumns}
            onVisibilityChange={columnChooser.onVisibilityChange}
          />
        ) : undefined
      }
      pagination={
        <PaginationControls
          currentPage={pagination.page}
          pageSize={pagination.pageSize}
          totalCount={pagination.displayTotalCount}
          onPageChange={pagination.setPage}
          onPageSizeChange={(size) => {
            pagination.setPageSize(size);
          }}
          pageSizeOptions={pagination.pageSizeOptions}
          entityLabelPlural={pagination.entityLabelPlural}
        />
      }
    >
      <DataGridTable<T> {...(dataGridProps as IOGridDataGridProps<T>)} />
    </OGridLayout>
  );
});

OGridInner.displayName = 'OGrid';

export const OGrid = React.memo(OGridInner) as typeof OGridInner;

