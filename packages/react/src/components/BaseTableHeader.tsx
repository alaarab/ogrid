// Header rows: optional column-letter row, group headers, leaf headers with
// filter + options menu + resize handles.

import * as React from 'react';
import { ROW_NUMBER_COLUMN_ID, ROW_NUMBER_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import { getHeaderFilterConfig, indexToColumnLetter } from '../utils';
import type { useColumnMeta } from '../hooks/useColumnMeta';
import type { UseDataGridTableOrchestrationResult } from '../hooks/useDataGridTableOrchestration';
import type { IColumnDef, IOGridDataGridProps } from '../types';
import type { DataGridStyles, DataGridPrimitives } from './BaseDataGridTable.types';

export interface BaseTableHeaderProps<T> {
  o: UseDataGridTableOrchestrationResult<T>;
  columnMeta: ReturnType<typeof useColumnMeta>;
  sortBy: IOGridDataGridProps<T>['sortBy'];
  sortDirection: IOGridDataGridProps<T>['sortDirection'];
  styles: DataGridStyles;
  primitives: DataGridPrimitives;
}

export function BaseTableHeader<T>(props: BaseTableHeaderProps<T>): React.ReactElement {
  const { o, columnMeta, sortBy, sortDirection, styles, primitives } = props;
  const {
    wrapperRef, interaction,
    handleResizeStart, handleResizeDoubleClick, isReorderDragging, handleHeaderMouseDown,
    visibleCols, hasCheckboxCol, hasRowNumbersCol, columnSizingOverrides,
    headerRows, showColumnLetters, columnReorder,
    allSelected, someSelected, handleSelectAll, setActiveCell,
    headerFilterInput, headerMenu,
  } = o;
  const { Thead, ColumnHeaderFilter, renderHeaderSelectAll } = primitives;

  return (
    <Thead className={o.stickyHeader ? styles.stickyHeader : undefined}>
      {showColumnLetters && (
        <primitives.Tr className={styles.columnLetterRow}>
          {hasCheckboxCol && <th className={styles.columnLetterCell} />}
          {hasRowNumbersCol && <th className={styles.columnLetterCell} />}
          {visibleCols.map((col, colIdx) => (
            <th
              key={col.columnId}
              className={`${styles.columnLetterCell}${columnMeta.hdrClasses[col.columnId] ? ` ${columnMeta.hdrClasses[col.columnId]}` : ''}`}
              style={columnMeta.hdrStyles[col.columnId]}
            >
              {indexToColumnLetter(colIdx)}
            </th>
          ))}
        </primitives.Tr>
      )}
      {headerRows.map((row, rowIdx) => (
        <primitives.Tr key={rowIdx}>
          {/* Checkbox header: show in last row (leaf row) */}
          {rowIdx === headerRows.length - 1 && hasCheckboxCol && (
            <primitives.Th className={styles.selectionHeaderCell} scope="col" rowSpan={1} key="__selection__">
              <div className={styles.selectionHeaderCellInner}>
                {renderHeaderSelectAll({ allSelected, someSelected, onChange: handleSelectAll })}
              </div>
            </primitives.Th>
          )}
          {/* Empty placeholder for checkbox alignment in non-leaf rows */}
          {rowIdx === 0 && rowIdx < headerRows.length - 1 && hasCheckboxCol && (
            <th rowSpan={headerRows.length - 1} key="__selection_placeholder__" />
          )}
          {/* Row numbers header: show in last row (leaf row) */}
          {rowIdx === headerRows.length - 1 && hasRowNumbersCol && (() => {
            const rowNumWidth = columnSizingOverrides?.[ROW_NUMBER_COLUMN_ID]?.widthPx ?? ROW_NUMBER_COLUMN_WIDTH;
            return (
              <primitives.Th className={styles.rowNumberHeaderCell} scope="col" rowSpan={1} key="__row_number__" style={{ width: rowNumWidth, minWidth: rowNumWidth, maxWidth: rowNumWidth }}>
                <div className={styles.rowNumberHeaderCellInner}>
                  #
                </div>
                <div
                  className={styles.resizeHandle}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize row number column"
                  onPointerDown={(e) => {
                    setActiveCell(null);
                    interaction.setSelectionRange(null);
                    wrapperRef.current?.focus({ preventScroll: true });
                    handleResizeStart(e, { columnId: ROW_NUMBER_COLUMN_ID, name: '#' } as IColumnDef<T>);
                  }}
                />
              </primitives.Th>
            );
          })()}
          {/* Empty placeholder for row numbers alignment in non-leaf rows */}
          {rowIdx === 0 && rowIdx < headerRows.length - 1 && hasRowNumbersCol && (
            <th rowSpan={headerRows.length - 1} key="__row_number_placeholder__" />
          )}
          {row.map((cell, cellIdx) => {
            if (cell.isGroup) {
              return (
                <th key={cellIdx} colSpan={cell.colSpan} className={styles.groupHeaderCell} scope="colgroup">
                  {cell.label}
                </th>
              );
            }
            // Leaf cell
            if (!cell.columnDef) return null;
            const col = cell.columnDef as IColumnDef<T>;
            const leafRowSpan = primitives.omitLeafRowSpan
              ? undefined
              : headerRows.length > 1 && rowIdx < headerRows.length - 1
              ? headerRows.length - rowIdx
              : undefined;

            // Determine aria-sort value for sorted columns
            const isSorted = sortBy === col.columnId;
            const ariaSort = isSorted
              ? (sortDirection === 'asc' ? 'ascending' : 'descending')
              : undefined;

            return (
              <primitives.Th
                key={col.columnId}
                scope="col"
                data-column-id={col.columnId}
                rowSpan={leafRowSpan}
                className={columnMeta.hdrClasses[col.columnId] || undefined}
                style={{
                  ...columnMeta.hdrStyles[col.columnId],
                  ...(columnReorder ? { cursor: isReorderDragging ? 'grabbing' : 'grab' } : undefined),
                }}
                aria-sort={ariaSort as 'ascending' | 'descending' | 'none' | undefined}
                onPointerDown={columnReorder ? (e: React.PointerEvent) => handleHeaderMouseDown(col.columnId, e) : undefined}
              >
                <div className={styles.headerCellContent}>
                  <ColumnHeaderFilter {...getHeaderFilterConfig(col, headerFilterInput)} />
                  <button
                    className={styles.headerMenuTrigger}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (headerMenu.isOpen && headerMenu.openForColumn === col.columnId) {
                        headerMenu.close();
                      } else {
                        headerMenu.open(col.columnId, e.currentTarget);
                      }
                    }}
                    aria-label="Column options"
                    title="Column options"
                  >
                    {'⋮'}
                  </button>
                </div>
                <div
                  className={styles.resizeHandle}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize ${col.name}`}
                  onPointerDown={(e) => {
                    // Clear cell selection/focus before resize so green outlines
                    // and blue :focus-visible rings don't persist during drag.
                    setActiveCell(null);
                    interaction.setSelectionRange(null);
                    // Move DOM focus to wrapper so no cell keeps :focus-visible
                    wrapperRef.current?.focus({ preventScroll: true });
                    handleResizeStart(e, col);
                  }}
                  onDoubleClick={(e) => handleResizeDoubleClick(e, col)}
                />
              </primitives.Th>
            );
          })}
        </primitives.Tr>
      ))}
    </Thead>
  );
}
