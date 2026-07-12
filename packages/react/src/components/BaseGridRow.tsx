// Memoized row component (skips re-render for rows unaffected by selection changes)

import * as React from 'react';
import { areGridRowPropsEqual, getGridCellSurfaceState } from '../utils';
import { PREVENT_DEFAULT, STOP_PROPAGATION } from '../constants/domHelpers';
import type { GridRowProps } from './createOGrid';
import type { DataGridStyles, DataGridPrimitives } from './BaseDataGridTable.types';

/** Extended props for column virtualization spacers. */
export interface BaseGridRowProps extends GridRowProps {
  leftSpacerWidth?: number;
  rightSpacerWidth?: number;
  /** Maps local column index to global index in full visibleCols. */
  globalColIndexMap?: number[];
  /** Dynamic width for the row number column (from resize overrides). */
  rowNumWidth?: number;
  styles: DataGridStyles;
  primitives: DataGridPrimitives;
}

function GridRowInner(props: BaseGridRowProps) {
  const {
    item, rowIndex, rowId, isSelected, visibleCols, columnMeta,
    renderCellContent, handleSingleRowClick, handleRowCheckboxChange,
    lastMouseShiftRef, hasCheckboxCol, hasRowNumbersCol, rowNumberOffset,
    leftSpacerWidth, rightSpacerWidth, globalColIndexMap, rowNumWidth,
    selectionRange, activeCell, cutRange, styles, primitives,
  } = props;
  const { Tr, Td, renderRowCheckbox } = primitives;

  return (
    <Tr
      className={isSelected ? styles.selectedRow : undefined}
      data-row-id={rowId}
      onClick={handleSingleRowClick}
      aria-selected={isSelected || undefined}
    >
      {hasCheckboxCol && (
        <Td className={styles.selectionCell}>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick only stops propagation so the checkbox click does not trigger row selection; keyboard interaction is handled by the grid's roving focus/keyboard-navigation layer */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: onClick only stops propagation; the inner checkbox is the interactive control */}
          {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: onClick only stops propagation; the inner checkbox is the interactive control */}
          <div
            className={styles.selectionCellInner}
            data-row-index={rowIndex}
            data-col-index={0}
            onClick={STOP_PROPAGATION}
          >
            {renderRowCheckbox({
              checked: isSelected,
              onCheckedChange: (c: boolean) =>
                handleRowCheckboxChange(rowId, c, rowIndex, lastMouseShiftRef.current),
              ariaLabel: `Select row ${rowIndex + 1}`,
            })}
          </div>
        </Td>
      )}
      {hasRowNumbersCol && (
        <Td
          className={styles.rowNumberCell}
          style={rowNumWidth ? { width: rowNumWidth, minWidth: rowNumWidth, maxWidth: rowNumWidth } : undefined}
          onPointerDown={PREVENT_DEFAULT}
        >
          <div className={styles.rowNumberCellInner}>
            {rowNumberOffset + rowIndex + 1}
          </div>
        </Td>
      )}
      {leftSpacerWidth != null && leftSpacerWidth > 0 && (
        <td style={{ padding: 0, border: 'none', width: leftSpacerWidth, minWidth: leftSpacerWidth }} aria-hidden />
      )}
      {visibleCols.map((col, colIdx) => {
        const globalIdx = globalColIndexMap ? (globalColIndexMap[colIdx] ?? colIdx) : colIdx;
        const surfaceState = getGridCellSurfaceState({
          rowIndex,
          columnIndex: globalIdx,
          selectionRange,
          activeCell,
          cutRange,
        });
        // Compute background override only when the cell has state.
        // For the ~99% of cells outside any selection/cut range this is
        // undefined, so we reuse the memoized baseStyle directly (zero allocation).
        const baseStyle = columnMeta.cellStyles[col.columnId];
        const bg = surfaceState.isCutCell
          ? 'var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04))'
          : surfaceState.isActiveRangeCell
          ? 'var(--ogrid-bg, #fff)'
          : surfaceState.isRangeCell
          ? 'var(--ogrid-range-bg, rgba(33, 115, 70, 0.12))'
          : undefined;
        return (
          <Td
            key={col.columnId}
            data-column-id={col.columnId}
            className={columnMeta.cellClasses[col.columnId] || undefined}
            style={bg ? { ...baseStyle, background: bg } : baseStyle}
            onPointerDown={PREVENT_DEFAULT}
          >
            {renderCellContent(item, col, rowIndex, globalIdx)}
          </Td>
        );
      })}
      {rightSpacerWidth != null && rightSpacerWidth > 0 && (
        <td style={{ padding: 0, border: 'none', width: rightSpacerWidth, minWidth: rightSpacerWidth }} aria-hidden />
      )}
    </Tr>
  );
}

export const GridRow = React.memo(GridRowInner, areGridRowPropsEqual);
