// Memoized row component (skips re-render for rows unaffected by selection changes)

import * as React from 'react';
import { CHECKBOX_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import { areGridRowPropsEqual, getGridCellSurfaceState } from '../utils';
import { PREVENT_DEFAULT, STOP_PROPAGATION } from '../constants/domHelpers';
import type { GridRowProps } from './createOGrid';
import type { DataGridStyles, DataGridPrimitives } from './BaseDataGridTable.types';

/** Layer a (possibly translucent) tint over an opaque base so sticky pinned cells never turn transparent. */
const opaqueOver = (tint: string) => `linear-gradient(${tint}, ${tint}), var(--ogrid-bg, #fff)`;

/** Extended props for column virtualization spacers. */
export interface BaseGridRowProps extends GridRowProps {
  leftSpacerWidth?: number;
  rightSpacerWidth?: number;
  /** Maps local column index to global index in full visibleCols. */
  globalColIndexMap?: number[];
  /** Dynamic width for the row number column (from resize overrides). */
  rowNumWidth?: number;
  // Comparator-only: cell content reads these through refs, so they are props
  // here only to repaint the row when they change.
  /** Popover editor anchor (editing row only); opens the popover once set. */
  popoverAnchorEl?: HTMLElement | null;
  /** Popover editor's pending value (editing row only). */
  pendingEditorValue?: unknown;
  /** Formula recalculation counter; a recalc can change any cell. */
  formulaVersion?: number;
  /**
   * Roving focus: column index (colOffset-based, like activeCell.columnIndex)
   * of the grid's one tab-stop cell when it is in this row, else -1. A number
   * so the memo comparator re-renders only the rows the tab stop enters/leaves.
   */
  tabStopColumn?: number;
  /** Ref callback for the tab-stop cell (stable identity). */
  registerTabStop?: (el: HTMLElement | null) => void;
  styles: DataGridStyles;
  primitives: DataGridPrimitives;
}

function GridRowInner(props: BaseGridRowProps) {
  const {
    item, rowIndex, rowId, isSelected, visibleCols, columnMeta,
    renderCellContent, handleSingleRowClick, handleRowCheckboxChange,
    lastMouseShiftRef, hasCheckboxCol, hasRowNumbersCol, rowNumberOffset, rowNumber, ariaRowIndexBase,
    leftSpacerWidth, rightSpacerWidth, globalColIndexMap, rowNumWidth,
    selectionRange, activeCell, cutRange, tabStopColumn = -1, registerTabStop, styles, primitives,
  } = props;
  const { Tr, Td, renderRowCheckbox } = primitives;
  // Leading columns stay put on horizontal scroll. Radix gets `position: sticky` from CSS;
  // Fluent's atomic `position: relative` needs the inline override (addStickyPosition).
  const stickyPos = primitives.addStickyPosition ? ({ position: 'sticky' } as const) : undefined;
  // Checkbox / row-number columns precede the data columns in aria-colindex.
  const leadingColCount = (hasCheckboxCol ? 1 : 0) + (hasRowNumbersCol ? 1 : 0);

  return (
    <Tr
      className={isSelected ? styles.selectedRow : undefined}
      data-row-id={rowId}
      onClick={handleSingleRowClick}
      aria-selected={isSelected || undefined}
      aria-rowindex={ariaRowIndexBase != null ? ariaRowIndexBase + rowIndex + 1 : undefined}
    >
      {hasCheckboxCol && (
        <Td
          className={styles.selectionCell}
          style={stickyPos ? { ...stickyPos, left: 0 } : undefined}
          // A navigable gridcell (roving tabindex); its checkbox is not a tab stop of its own.
          ref={tabStopColumn === 0 ? registerTabStop : undefined}
          tabIndex={tabStopColumn === 0 ? 0 : -1}
          aria-colindex={1}
        >
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
              onCheckedChange: (c: boolean) => {
                // Shift applies to the press that caused this toggle only.
                const shiftKey = lastMouseShiftRef.current;
                lastMouseShiftRef.current = false;
                handleRowCheckboxChange(rowId, c, rowIndex, shiftKey);
              },
              ariaLabel: `Select row ${rowIndex + 1}`,
            })}
          </div>
        </Td>
      )}
      {hasRowNumbersCol && (
        <Td
          className={styles.rowNumberCell}
          style={{
            ...stickyPos,
            left: hasCheckboxCol ? CHECKBOX_COLUMN_WIDTH : 0,
            ...(rowNumWidth ? { width: rowNumWidth, minWidth: rowNumWidth, maxWidth: rowNumWidth } : undefined),
          }}
          onPointerDown={PREVENT_DEFAULT}
        >
          <div className={styles.rowNumberCellInner}>
            {rowNumber ?? rowNumberOffset + rowIndex + 1}
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
          colOffset: leadingColCount,
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
        const isTabStop = tabStopColumn === leadingColCount + globalIdx;
        return (
          <Td
            key={col.columnId}
            ref={isTabStop ? registerTabStop : undefined}
            // Roving tabindex: the grid's one tab stop is 0, every other data cell -1.
            tabIndex={isTabStop ? 0 : -1}
            data-column-id={col.columnId}
            aria-colindex={leadingColCount + globalIdx + 1}
            aria-selected={surfaceState.isActiveRangeCell || surfaceState.isRangeCell ? true : undefined}
            className={columnMeta.cellClasses[col.columnId] || undefined}
            style={bg ? { ...baseStyle, background: baseStyle && (baseStyle.left != null || baseStyle.right != null) ? opaqueOver(bg) : bg } : baseStyle}
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
