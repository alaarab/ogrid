// Memoized row component (skips re-render for rows unaffected by selection changes)

import * as React from 'react';
import { CHECKBOX_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import { areGridRowPropsEqual, getGridCellSurfaceState } from '../utils';
import { PREVENT_DEFAULT, STOP_PROPAGATION } from '../constants/domHelpers';
import { ROW_HEADER_INDEX_ATTR } from '../hooks/useSheetSelection';
import type { GridRowProps } from './createOGrid';
import type { IColumnDef } from '../types';
import type { DataGridStyles, DataGridPrimitives } from './BaseDataGridTable.types';

/** Layer a (possibly translucent) tint over an opaque base so sticky pinned cells never turn transparent. */
const opaqueOver = (tint: string) => `linear-gradient(${tint}, ${tint}), var(--ogrid-bg, #fff)`;

/** How one rendered cell of a merged block draws. */
export interface MergedCellRender {
  rowSpan: number;
  colSpan: number;
  /** The merge's anchor: its row, visible data column, row item and column. */
  anchorRow: number;
  anchorCol: number;
  anchorItem: unknown;
  anchorColumn: IColumnDef<unknown>;
}

/**
 * Per-row merge plan keyed by visible data column index: a `MergedCellRender`
 * draws the block's rendered portion from this cell, `null` skips a cell the
 * block covers. Columns without an entry render normally.
 */
export type RowMergePlan = Record<number, MergedCellRender | null>;

const FROZEN_CELL_STYLE: React.CSSProperties = {
  position: 'sticky',
  top: 'var(--ogrid-frozen-top, 0px)',
  zIndex: 'var(--ogrid-z-frozen, 7)' as unknown as number,
};
const FROZEN_PINNED_CELL_STYLE: React.CSSProperties = {
  ...FROZEN_CELL_STYLE,
  zIndex: 'var(--ogrid-z-frozen-pinned, 9)' as unknown as number,
};

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
  /** Merged cells drawn from or covered in this row (see RowMergePlan). */
  mergePlan?: RowMergePlan;
  /**
   * Comparator-only: interaction state of the merges drawn from this row. A
   * merged cell spans rows the row-scoped comparator checks don't see.
   */
  mergeStateKey?: string;
  /** Frozen top row ('last' for the last one, which draws the divider). */
  frozen?: 'inner' | 'last';
  /** Row height override in px (a resized row). */
  customRowHeight?: number;
  /** Pointer-down for the row-number resize handle (stable identity); omit to hide the handle. */
  onRowResizeStart?: (e: React.PointerEvent, rowId: string | number) => void;
  /** Pointer down on the row number cell: select the whole row (stable identity). */
  onRowHeaderPointerDown?: (e: React.PointerEvent, rowIndex: number) => void;
  styles: DataGridStyles;
  primitives: DataGridPrimitives;
}

function GridRowInner(props: BaseGridRowProps) {
  const {
    item, rowIndex, rowId, isSelected, visibleCols, columnMeta,
    renderCellContent, handleSingleRowClick, handleRowCheckboxChange,
    lastMouseShiftRef, hasCheckboxCol, hasRowNumbersCol, rowNumberOffset, rowNumber, ariaRowIndexBase,
    leftSpacerWidth, rightSpacerWidth, globalColIndexMap, rowNumWidth,
    selectionRange, activeCell, cutRange, tabStopColumn = -1, registerTabStop, mergePlan, frozen,
    customRowHeight, onRowResizeStart, styles, primitives,
    onRowHeaderPointerDown,
  } = props;
  const { Tr, Td, renderRowCheckbox } = primitives;
  // Leading columns stay put on horizontal scroll. Radix gets `position: sticky` from CSS;
  // Fluent's atomic `position: relative` needs the inline override (addStickyPosition).
  const stickyPos = primitives.addStickyPosition ? ({ position: 'sticky' } as const) : undefined;
  // Checkbox / row-number columns precede the data columns in aria-colindex.
  const leadingColCount = (hasCheckboxCol ? 1 : 0) + (hasRowNumbersCol ? 1 : 0);
  // Frozen rows stick below the header (top comes from useFrozenRowOffsets); leading
  // cells are sticky on both axes, so they sit above the frozen data cells.
  const frozenLeading = frozen ? FROZEN_PINNED_CELL_STYLE : undefined;
  const rowClass = [
    isSelected ? styles.selectedRow : '',
    frozen ? styles.frozenRow : '',
    frozen === 'last' ? styles.frozenRowLast : '',
  ].filter(Boolean).join(' ');

  return (
    <Tr
      className={rowClass || undefined}
      data-row-id={rowId}
      data-frozen-row={frozen ? '' : undefined}
      onClick={handleSingleRowClick}
      aria-selected={isSelected || undefined}
      aria-rowindex={ariaRowIndexBase != null ? ariaRowIndexBase + rowIndex + 1 : undefined}
      style={customRowHeight != null ? { height: customRowHeight } : undefined}
    >
      {hasCheckboxCol && (
        <Td
          className={styles.selectionCell}
          style={stickyPos || frozenLeading ? { ...stickyPos, ...frozenLeading, left: 0 } : undefined}
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
            ...frozenLeading,
            left: hasCheckboxCol ? CHECKBOX_COLUMN_WIDTH : 0,
            ...(rowNumWidth ? { width: rowNumWidth, minWidth: rowNumWidth, maxWidth: rowNumWidth } : undefined),
          }}
          // Click selects the whole row (Shift extends, drag across row numbers extends).
          {...{ [ROW_HEADER_INDEX_ATTR]: rowIndex }}
          onPointerDown={onRowHeaderPointerDown ? (e: React.PointerEvent) => onRowHeaderPointerDown(e, rowIndex) : PREVENT_DEFAULT}
        >
          <div className={styles.rowNumberCellInner}>
            {rowNumber ?? rowNumberOffset + rowIndex + 1}
          </div>
          {onRowResizeStart && (
            // Pointer-only affordance (like Excel's row boundary); rows have no keyboard resize.
            <div
              className={styles.rowResizeHandle}
              data-row-resize-handle=""
              aria-hidden
              onPointerDown={(e) => onRowResizeStart(e, rowId)}
            />
          )}
        </Td>
      )}
      {leftSpacerWidth != null && leftSpacerWidth > 0 && (
        <td style={{ padding: 0, border: 'none', width: leftSpacerWidth, minWidth: leftSpacerWidth }} aria-hidden />
      )}
      {visibleCols.map((col, colIdx) => {
        const globalIdx = globalColIndexMap ? (globalColIndexMap[colIdx] ?? colIdx) : colIdx;
        const merged = mergePlan?.[globalIdx];
        // Covered by a merged cell drawn from another cell.
        if (merged === null) return null;
        // A merged cell draws its anchor's content and state.
        const cellRow = merged ? merged.anchorRow : rowIndex;
        const cellCol = merged ? merged.anchorCol : globalIdx;
        const surfaceState = getGridCellSurfaceState({
          rowIndex: cellRow,
          columnIndex: cellCol,
          selectionRange,
          activeCell,
          cutRange,
          colOffset: leadingColCount,
        });
        // Compute background override only when the cell has state.
        // For the ~99% of cells outside any selection/cut range this is
        // undefined, so we reuse the memoized baseStyle directly (zero allocation).
        const colStyle = columnMeta.cellStyles[col.columnId];
        // A cell spanning columns takes its width from the columns it covers.
        const metaStyle = merged && merged.colSpan > 1
          ? { ...colStyle, width: undefined, maxWidth: undefined, textAlign: columnMeta.cellStyles[merged.anchorColumn.columnId]?.textAlign }
          : colStyle;
        const isPinnedCell = metaStyle != null && (metaStyle.left != null || metaStyle.right != null);
        const baseStyle = frozen
          ? { ...metaStyle, ...(isPinnedCell ? FROZEN_PINNED_CELL_STYLE : FROZEN_CELL_STYLE) }
          : metaStyle;
        const bg = surfaceState.isCutCell
          ? 'var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04))'
          : surfaceState.isActiveRangeCell
          ? 'var(--ogrid-bg, #fff)'
          : surfaceState.isRangeCell
          ? 'var(--ogrid-range-bg, rgba(33, 115, 70, 0.12))'
          : undefined;
        const isTabStop = tabStopColumn === leadingColCount + cellCol;
        const cellClass = columnMeta.cellClasses[col.columnId];
        return (
          <Td
            key={col.columnId}
            ref={isTabStop ? registerTabStop : undefined}
            // Roving tabindex: the grid's one tab stop is 0, every other data cell -1.
            tabIndex={isTabStop ? 0 : -1}
            data-column-id={merged ? merged.anchorColumn.columnId : col.columnId}
            data-merged={merged ? '' : undefined}
            rowSpan={merged && merged.rowSpan > 1 ? merged.rowSpan : undefined}
            colSpan={merged && merged.colSpan > 1 ? merged.colSpan : undefined}
            aria-colindex={leadingColCount + cellCol + 1}
            aria-selected={surfaceState.isActiveRangeCell || surfaceState.isRangeCell ? true : undefined}
            className={(merged ? `${cellClass ?? ''} ${styles.mergedCell ?? ''}`.trim() : cellClass) || undefined}
            style={bg ? { ...baseStyle, background: isPinnedCell ? opaqueOver(bg) : bg } : baseStyle}
            onPointerDown={PREVENT_DEFAULT}
          >
            {merged
              ? renderCellContent(merged.anchorItem, merged.anchorColumn, merged.anchorRow, merged.anchorCol)
              : renderCellContent(item, col, rowIndex, globalIdx)}
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
