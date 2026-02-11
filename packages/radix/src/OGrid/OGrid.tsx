import * as React from 'react';
import { forwardRef } from 'react';
import { DataGridTable } from '../DataGridTable/DataGridTable';
import type { IOGridDataGridProps } from '@alaarab/ogrid-core';
import { ColumnChooser } from '../ColumnChooser/ColumnChooser';
import { PaginationControls } from '../PaginationControls/PaginationControls';
import {
  useOGrid,
  OGridLayout,
  type IOGridProps,
  type IOGridApi,
} from '@alaarab/ogrid-core';

export type { IOGridProps } from '@alaarab/ogrid-core';

const OGridInner = forwardRef(function OGridInner<T>(
  props: IOGridProps<T>,
  ref: React.Ref<IOGridApi<T>>
): React.ReactElement {
  const { dataGridProps, pagination, columnChooser, layout } = useOGrid(props, ref);

  return (
    <OGridLayout
      className={layout.className}
      sideBar={layout.sideBarProps}
      toolbar={layout.toolbar}
      toolbarBelow={layout.toolbarBelow}
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
            pagination.setPage(1);
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
