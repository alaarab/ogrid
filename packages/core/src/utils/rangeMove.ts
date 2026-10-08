/**
 * Pure cell-range move helpers ("drag the selection border to move", with
 * Ctrl to copy). A move routes through the same value path as cut + paste:
 * the source is serialised to TSV, parsed and applied at the target with each
 * column's `valueParser` and formula-reference shifting, then the source cells
 * that were not overwritten are cleared. This keeps move undoable and
 * formula-aware for free.
 */
import type { IColumnDef, ICellValueChangedEvent } from '../types/columnTypes';
import type { ISelectionRange } from '../types/dataGridTypes';
import { normalizeSelectionRange } from '../types';
import {
  applyCutClear,
  applyPastedValues,
  formatSelectionAsTsv,
  parseTsvClipboard,
} from './clipboardHelpers';
import type { IPasteFormulaSource } from './clipboardHelpers';
import { isColumnEditable } from './cellValue';

/** Formula-aware options shared by the TSV read and the paste write. */
export interface RangeMoveFormulaOptions<T> {
  colOffset: number;
  flatColumns: IColumnDef<T>[];
  /** Formula text of a cell (flat column, display row). */
  getFormula?: (col: number, row: number) => string | undefined;
  /** Whether a cell holds a formula (flat column, display row). */
  hasFormula?: (col: number, row: number) => boolean;
  /** Write a formula (flat column, display row) through the grid's edit path. */
  setFormula?: (col: number, row: number, formula: string | null) => void;
  /** Sheet row of a display row, so pasted formulas shift in sheet space. */
  formulaRow?: (rowIndex: number) => number;
}

/** Parameters for {@link moveCellRange}. */
export interface MoveCellRangeParams<T> {
  /** Displayed rows the range indexes into. */
  items: T[];
  /** Visible columns the range indexes into. */
  visibleCols: IColumnDef<T>[];
  /** The range being moved (any corner order). */
  source: ISelectionRange;
  /** Display row of the drop target's top-left cell. */
  targetRow: number;
  /** Display column of the drop target's top-left cell. */
  targetCol: number;
  /** Ctrl-drag: copy instead of move; the source is left intact. */
  copy?: boolean;
  /** Where the block came from in sheet space, so formulas shift by the offset. */
  formulaSource?: IPasteFormulaSource;
  /** Formula support; omit for a plain value grid. */
  formulaOptions?: RangeMoveFormulaOptions<T>;
  /** Cells covered by a merged cell are skipped (only the anchor takes a value). */
  isCoveredCell?: (row: number, col: number) => boolean;
}

/**
 * The value events a range move/copy produces: paste events at the target,
 * plus clear events for source cells that were not overwritten (move only).
 * Returns an empty array when the range is empty, an unchanged move is a
 * no-op, or any destination cell rejects the write (bounds, editability,
 * merges or parsing). Rejected moves leave source values and formulas intact.
 */
export function moveCellRange<T>(params: MoveCellRangeParams<T>): ICellValueChangedEvent<T>[] {
  const {
    items, visibleCols, source, targetRow, targetCol, copy = false,
    formulaSource, formulaOptions, isCoveredCell,
  } = params;
  const norm = normalizeSelectionRange(source);
  if (norm.endRow < norm.startRow || norm.endCol < norm.startCol) return [];
  // A move onto its own origin changes nothing.
  if (!copy && targetRow === norm.startRow && targetCol === norm.startCol) return [];

  // Moving must clear every source cell. Reject protected sources before
  // planning any destination writes, including read-only spill children.
  if (!copy) {
    for (let row = norm.startRow; row <= norm.endRow; row++) {
      const item = items[row];
      if (item === undefined) return [];
      for (let col = norm.startCol; col <= norm.endCol; col++) {
        const column = visibleCols[col];
        if (!column || !isColumnEditable(column, item)) return [];
      }
    }
  }

  const text = formatSelectionAsTsv(
    items,
    visibleCols,
    norm,
    formulaOptions && {
      colOffset: formulaOptions.colOffset,
      flatColumns: formulaOptions.flatColumns,
      getFormula: formulaOptions.getFormula,
      hasFormula: formulaOptions.hasFormula,
    },
    isCoveredCell,
  );
  const parsed = parseTsvClipboard(text);
  if (parsed.length === 0) return [];

  // Plan every destination write before touching formulas or source values.
  // Formula writes produce no value event, so collect them separately when
  // deciding whether the complete block fits and accepts its values.
  const formulaWrites: { col: number; row: number; formula: string | null }[] = [];
  const pasteEvents = applyPastedValues(
    parsed,
    targetRow,
    targetCol,
    items,
    visibleCols,
    formulaOptions && {
      colOffset: formulaOptions.colOffset,
      flatColumns: formulaOptions.flatColumns,
      setFormula: formulaOptions.setFormula && ((col, row, formula) => {
        if ((formulaOptions.formulaRow?.(row) ?? row) >= 0) {
          formulaWrites.push({ col, row, formula });
        }
      }),
      source: formulaSource,
      formulaRow: formulaOptions.formulaRow,
    },
    isCoveredCell,
  );

  const cellCount = parsed.reduce((count, row) => count + row.length, 0);
  if (pasteEvents.length + formulaWrites.length !== cellCount) return [];
  for (const write of formulaWrites) {
    formulaOptions?.setFormula?.(write.col, write.row, write.formula);
  }
  if (copy) return pasteEvents;

  const width = parsed.reduce((w, row) => Math.max(w, row.length), 0);
  const destEndRow = targetRow + parsed.length - 1;
  const destEndCol = targetCol + width - 1;
  const clearEvents = applyCutClear(norm, items, visibleCols).filter(
    (e) =>
      !(e.rowIndex >= targetRow && e.rowIndex <= destEndRow && inRange(e.columnId)),
  );
  function inRange(columnId: string): boolean {
    const c = visibleCols.findIndex((col) => col.columnId === columnId);
    return c >= targetCol && c <= destEndCol;
  }
  return [...pasteEvents, ...clearEvents];
}
