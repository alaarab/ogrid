import * as React from 'react';
import { forwardRef } from 'react';
import { useOGrid } from '../hooks';
import { OGridLayout } from './OGridLayout';
import type { IOGridProps, IOGridApi, IOGridDataGridProps } from '../types';
import type { IColumnDef, IColumnDefinition } from '../types';
import type { IColumnChooserProps } from './ColumnChooserProps';
import type { IPaginationControlsProps } from './PaginationControlsProps';

export interface InlineCellEditorProps<T> {
  value: unknown;
  item: T;
  column: IColumnDef<T>;
  rowIndex: number;
  editorType: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}

export interface GridRowProps {
  item: unknown;
  rowIndex: number;
  rowId: string | number;
  isSelected: boolean;
  visibleCols: IColumnDef<unknown>[];
  columnMeta: { cellStyles: Record<string, React.CSSProperties>; cellClasses: Record<string, string> };
  renderCellContent: (item: unknown, col: IColumnDef<unknown>, rowIndex: number, colIdx: number) => React.ReactNode;
  handleSingleRowClick: (e: React.MouseEvent<HTMLTableRowElement>) => void;
  handleRowCheckboxChange: (rowId: string | number, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
  lastMouseShiftRef: React.MutableRefObject<boolean>;
  hasCheckboxCol: boolean;
  hasRowNumbersCol: boolean;
  rowNumberOffset: number;
  // Comparator-only props (drive re-render decisions, not used in render body)
  selectionRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  activeCell: { rowIndex: number; columnIndex: number } | null;
  cutRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  copyRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  isDragging: boolean;
  editingRowId: string | number | null;
}

export interface CreateOGridComponents {
  DataGridTable: React.ComponentType<IOGridDataGridProps<unknown>>;
  ColumnChooser: React.ComponentType<IColumnChooserProps>;
  PaginationControls: React.ComponentType<IPaginationControlsProps>;
  /** Optional wrapper component + props (e.g. MUI Box with sx). */
  containerComponent?: React.ElementType;
  containerProps?: Record<string, unknown>;
}

/**
 * Factory that creates a memoized, forwardRef OGrid component.
 * Used by Radix and Fluent to avoid duplicating the same wiring code.
 * Material uses its own OGrid because it adds MUI theme bridging (containerSx).
 */
export function createOGrid(components: CreateOGridComponents) {
  const {
    DataGridTable,
    ColumnChooser,
    PaginationControls,
    containerComponent,
    containerProps,
  } = components;

  const OGridInner = forwardRef(function OGridInner<T>(
    props: IOGridProps<T>,
    ref: React.Ref<IOGridApi<T>>
  ): React.ReactElement {
    const { dataGridProps, pagination, columnChooser, layout } = useOGrid(props, ref);

    return (
      <OGridLayout
        containerComponent={containerComponent}
        containerProps={containerProps}
        className={layout.className}
        sideBar={layout.sideBarProps}
        toolbar={layout.toolbar}
        toolbarBelow={layout.toolbarBelow}
        fullScreen={layout.fullScreen}
        formulaBar={layout.formulaBar}
        sheetTabs={layout.sheetTabs}
        toolbarEnd={
          columnChooser.placement === 'toolbar' ? (
            <ColumnChooser
              columns={columnChooser.columns as IColumnDefinition[]}
              visibleColumns={columnChooser.visibleColumns}
              onVisibilityChange={columnChooser.onVisibilityChange}
              onSetVisibleColumns={columnChooser.onSetVisibleColumns}
            />
          ) : undefined
        }
        pagination={
          // Hidden in full-dataset virtualization mode (virtualScroll.paginate
          // === false) — the grid scrolls the whole dataset, so there are no
          // pages to navigate.
          pagination.hidden ? undefined : (
            <PaginationControls
              currentPage={pagination.page}
              pageSize={pagination.pageSize}
              totalCount={pagination.displayTotalCount}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              pageSizeOptions={pagination.pageSizeOptions}
              entityLabelPlural={pagination.entityLabelPlural}
            />
          )
        }
      >
        <DataGridTable {...(dataGridProps as IOGridDataGridProps<unknown>)} />
      </OGridLayout>
    );
  });

  OGridInner.displayName = 'OGrid';

  return React.memo(OGridInner) as typeof OGridInner;
}
