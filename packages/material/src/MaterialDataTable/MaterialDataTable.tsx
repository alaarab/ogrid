import * as React from 'react';
import { forwardRef } from 'react';
import { Box } from '@mui/material';
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
    title,
    toolbar,
    className,
    entityLabelPlural,
    pageSizeOptions,
    sideBarProps,
    columnChooserPlacement,
  } = useOGrid(props, ref);

  return (
    <OGridLayout
      containerComponent={Box}
      containerProps={{ sx: { display: 'flex', flexDirection: 'column', gap: 1 } }}
      className={className}
      gap={0}
      sideBar={sideBarProps}
      title={title}
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

/** @deprecated Use OGrid and IOGridProps. Kept for backward compatibility. */
export const MaterialDataTable = OGrid;
/** @deprecated Use IOGridProps. Kept for backward compatibility. */
export type IMaterialDataTableProps<T> = IOGridProps<T>;
