import * as React from 'react';
import { forwardRef } from 'react';
import { DataGridTable } from '../DataGridTable/DataGridTable';
import type { IDataGridTableProps } from '../DataGridTable/DataGridTable';
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
  const {
    dataGridProps,
    page,
    pageSize,
    displayTotalCount,
    setPage,
    setPageSize,
    columnChooserColumns,
    visibleColumns,
    handleVisibilityChange,
    columnChooserPlacement,
    toolbar,
    className,
    entityLabelPlural,
    pageSizeOptions,
    sideBarProps,
  } = useOGrid(props, ref);

  return (
    <OGridLayout
      className={className}
      sideBar={sideBarProps}
      toolbar={toolbar}
      toolbarEnd={
        columnChooserPlacement === 'toolbar' ? (
          <ColumnChooser
            columns={columnChooserColumns}
            visibleColumns={visibleColumns}
            onVisibilityChange={handleVisibilityChange}
          />
        ) : undefined
      }
      pagination={
        <PaginationControls
          currentPage={page}
          pageSize={pageSize}
          totalCount={displayTotalCount}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          pageSizeOptions={pageSizeOptions}
          entityLabelPlural={entityLabelPlural}
        />
      }
    >
      <DataGridTable<T> {...(dataGridProps as IDataGridTableProps<T>)} />
    </OGridLayout>
  );
});

OGridInner.displayName = 'OGrid';

export const OGrid = React.memo(OGridInner) as typeof OGridInner;
