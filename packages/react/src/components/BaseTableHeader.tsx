// Header rows: optional column-letter row, group headers, leaf headers with
// filter + options menu + resize handles.

import * as React from 'react';
import { CHECKBOX_COLUMN_WIDTH, ROW_NUMBER_COLUMN_ID, ROW_NUMBER_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import { getHeaderFilterConfig, indexToColumnLetter } from '../utils';
import { useHeaderFilterConfigs } from '../hooks/useHeaderFilterConfigs';
import type { useColumnMeta } from '../hooks/useColumnMeta';
import type { UseDataGridTableOrchestrationResult } from '../hooks/useDataGridTableOrchestration';
import type { HeaderRow, IColumnDef, IOGridDataGridProps } from '../types';
import type { DataGridStyles, DataGridPrimitives } from './BaseDataGridTable.types';

/**
 * For kits that can't use `rowSpan` on leaf header cells (Fluent): move every leaf that
 * sits above the bottom header row down to it, and leave an empty placeholder cell in the
 * rows it vacated, so each row still covers every column and groups line up over their leaves.
 * Child cells partition their parent group's columns, which gives each cell's start column.
 */
function padLeafHeaderRows<T>(rows: HeaderRow<T>[]): HeaderRow<T>[] {
  const last = rows.length - 1;
  if (last < 1) return rows;
  type Placed = { start: number; cell: HeaderRow<T>[number] };
  const out: Placed[][] = rows.map(() => []);
  // Parents of the next row: group cells of this row with their start column.
  let parents: { start: number; span: number }[] = [{ start: 0, span: Number.POSITIVE_INFINITY }];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const nextParents: { start: number; span: number }[] = [];
    let pi = 0;
    let consumed = 0;
    let parentStart = parents[0]?.start ?? 0;
    for (const cell of row) {
      while (consumed >= (parents[pi]?.span ?? Number.POSITIVE_INFINITY)) {
        pi++;
        consumed = 0;
        parentStart = parents[pi]?.start ?? parentStart;
      }
      const start = parentStart + consumed;
      consumed += cell.colSpan;
      if (cell.isGroup) {
        nextParents.push({ start, span: cell.colSpan });
        out[r]?.push({ start, cell });
      } else if (r < last) {
        const placeholder = { label: '', colSpan: 1, isGroup: false, depth: r } as HeaderRow<T>[number];
        for (let k = r; k < last; k++) out[k]?.push({ start, cell: { ...placeholder, depth: k } });
        out[last]?.push({ start, cell });
      } else {
        out[r]?.push({ start, cell });
      }
    }
    parents = nextParents;
  }
  return out.map((row) => row.sort((a, b) => a.start - b.start).map((p) => p.cell));
}

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
    showColumnLetters, columnReorder,
    allSelected, someSelected, handleSelectAll, setActiveCell,
    headerFilterInput, headerMenu,
  } = o;
  const { Thead, ColumnHeaderFilter, renderHeaderSelectAll } = primitives;
  const headerFilterConfigs = useHeaderFilterConfigs(visibleCols, headerFilterInput);
  const headerRows = React.useMemo(
    () => (primitives.omitLeafRowSpan ? padLeafHeaderRows(o.headerRows) : o.headerRows),
    [o.headerRows, primitives.omitLeafRowSpan],
  );
  // See BaseGridRow: Fluent needs inline sticky for the leading columns.
  const stickyPos = primitives.addStickyPosition ? ({ position: 'sticky' } as const) : undefined;
  // Spacer cells above the checkbox/row-number headers (column-letter row, group rows) are held to
  // the column width: a wider spacer widens the column and breaks the sticky offsets built on it.
  const leadingRowNumWidth = columnSizingOverrides?.[ROW_NUMBER_COLUMN_ID]?.widthPx ?? ROW_NUMBER_COLUMN_WIDTH;
  const checkboxSpacerStyle: React.CSSProperties = { boxSizing: 'border-box', width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH, maxWidth: CHECKBOX_COLUMN_WIDTH };
  const rowNumberSpacerStyle: React.CSSProperties = { boxSizing: 'border-box', width: leadingRowNumWidth, minWidth: leadingRowNumWidth, maxWidth: leadingRowNumWidth };

  return (
    <Thead className={o.stickyHeader ? styles.stickyHeader : undefined}>
      {showColumnLetters && (
        <primitives.Tr className={styles.columnLetterRow} aria-rowindex={1}>
          {hasCheckboxCol && <th className={styles.columnLetterCell} style={checkboxSpacerStyle} />}
          {hasRowNumbersCol && <th className={styles.columnLetterCell} style={rowNumberSpacerStyle} />}
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
        // biome-ignore lint/suspicious/noArrayIndexKey: header rows are structural depth levels of the column-group tree; the index IS the row's identity and rows are rebuilt wholesale (never reordered in place)
        <primitives.Tr key={rowIdx} aria-rowindex={rowIdx + 1 + (showColumnLetters ? 1 : 0)}>
          {/* Checkbox header: show in last row (leaf row) */}
          {rowIdx === headerRows.length - 1 && hasCheckboxCol && (
            <primitives.Th className={styles.selectionHeaderCell} scope="col" rowSpan={1} key="__selection__" style={stickyPos ? { ...stickyPos, left: 0 } : undefined}>
              <div className={styles.selectionHeaderCellInner}>
                {renderHeaderSelectAll({ allSelected, someSelected, onChange: handleSelectAll })}
              </div>
            </primitives.Th>
          )}
          {/* Empty placeholder for checkbox alignment in non-leaf rows */}
          {rowIdx === 0 && rowIdx < headerRows.length - 1 && hasCheckboxCol && (
            <th rowSpan={headerRows.length - 1} key="__selection_placeholder__" style={checkboxSpacerStyle} />
          )}
          {/* Row numbers header: show in last row (leaf row) */}
          {rowIdx === headerRows.length - 1 && hasRowNumbersCol && (() => {
            const rowNumWidth = columnSizingOverrides?.[ROW_NUMBER_COLUMN_ID]?.widthPx ?? ROW_NUMBER_COLUMN_WIDTH;
            return (
              <primitives.Th className={styles.rowNumberHeaderCell} scope="col" rowSpan={1} key="__row_number__" style={{ ...stickyPos, left: hasCheckboxCol ? CHECKBOX_COLUMN_WIDTH : 0, width: rowNumWidth, minWidth: rowNumWidth, maxWidth: rowNumWidth }}>
                <div className={styles.rowNumberHeaderCellInner}>
                  #
                </div>
                {/* biome-ignore lint/a11y/useFocusableInteractive: resize handle is a pointer-only drag affordance; it is deliberately kept out of the tab order (grid keyboard interaction is centralized in the grid's keyboard-navigation layer) */}
                {/* biome-ignore lint/a11y/useSemanticElements: an <hr> inside a th would break the table header layout; role="separator" on a styled div is intentional */}
                <div
                  className={styles.resizeHandle}
                  // biome-ignore lint/a11y/useAriaPropsForRole: the drag-driven resize handle has no meaningful discrete value to expose via aria-valuenow
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
            <th rowSpan={headerRows.length - 1} key="__row_number_placeholder__" style={rowNumberSpacerStyle} />
          )}
          {row.map((cell, cellIdx) => {
            if (cell.isGroup) {
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: group header cells have no stable id (labels may repeat) and the header layout is rebuilt wholesale when columns change — cells are never reordered in place
                <th key={cellIdx} colSpan={cell.colSpan} className={styles.groupHeaderCell} scope="colgroup">
                  {cell.label}
                </th>
              );
            }
            // Leaf cell
            if (!cell.columnDef) {
              // Empty placeholder above a leaf that was moved to the bottom row (see padLeafHeaderRows).
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no id and are rebuilt wholesale with the header rows
              return <th key={`__pad_${cellIdx}`} />;
            }
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
                  <ColumnHeaderFilter {...(headerFilterConfigs.get(col.columnId) ?? getHeaderFilterConfig(col, headerFilterInput))} />
                  <button
                    type="button"
                    className={styles.headerMenuTrigger}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (headerMenu.isOpen && headerMenu.openForColumn === col.columnId) {
                        headerMenu.close();
                      } else {
                        headerMenu.open(col.columnId, e.currentTarget);
                      }
                    }}
                    onKeyDown={(e) => {
                      // The trigger owns Enter/Space/Arrow keys so the grid handler can't preventDefault them
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.stopPropagation();
                        e.preventDefault();
                        headerMenu.open(col.columnId, e.currentTarget);
                      }
                    }}
                    aria-haspopup="menu"
                    aria-expanded={headerMenu.isOpen && headerMenu.openForColumn === col.columnId}
                    aria-label={`${col.name} column options`}
                    title={`${col.name} column options`}
                  >
                    {'⋮'}
                  </button>
                </div>
                {/* biome-ignore lint/a11y/useFocusableInteractive: resize handle is a pointer-only drag affordance; it is deliberately kept out of the tab order (grid keyboard interaction is centralized in the grid's keyboard-navigation layer) */}
                {/* biome-ignore lint/a11y/useSemanticElements: an <hr> inside a th would break the table header layout; role="separator" on a styled div is intentional */}
                <div
                  className={styles.resizeHandle}
                  // biome-ignore lint/a11y/useAriaPropsForRole: the drag-driven resize handle has no meaningful discrete value to expose via aria-valuenow
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
