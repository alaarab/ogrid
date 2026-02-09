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
  } = useOGrid(props, ref);

  return (
    <OGridLayout
      containerComponent={Box}
      containerProps={{ sx: { display: 'flex', flexDirection: 'column', gap: 2 } }}
      className={className}
      gap={0}
      title={title}
      toolbar={toolbar}
      columnChooser={
        <ColumnChooser
          columns={columnChooserColumns}
          visibleColumns={visibleColumns}
          onVisibilityChange={handleVisibilityChange}
        />
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
