import { areGridRowPropsEqual } from '../gridRowComparator';
import type { GridRowComparatorProps } from '../gridRowComparator';

const item = { id: 'r2' };
const visibleCols = [{ columnId: 'a' }];
const columnMeta = { cellStyles: {}, cellClasses: {} };
const renderCellContent = () => null;

function rowProps(overrides: Partial<GridRowComparatorProps> & Record<string, unknown> = {}): GridRowComparatorProps {
  return {
    item,
    rowIndex: 2,
    rowId: 'r2',
    isSelected: false,
    hasCheckboxCol: false,
    hasRowNumbersCol: false,
    rowNumberOffset: 0,
    ariaRowIndexBase: 1,
    formulaVersion: 0,
    selectionRange: null,
    activeCell: null,
    cutRange: null,
    copyRange: null,
    isDragging: false,
    editingRowId: null,
    visibleCols,
    columnMeta,
    renderCellContent,
    ...overrides,
  } as GridRowComparatorProps;
}

describe('areGridRowPropsEqual', () => {
  it('skips a row whose props are all unchanged', () => {
    expect(areGridRowPropsEqual(rowProps(), rowProps())).toBe(true);
  });

  it('skips a row when the selection moves between other rows', () => {
    const prev = rowProps({ selectionRange: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }, activeCell: { rowIndex: 0, columnIndex: 0 } });
    const next = rowProps({ selectionRange: { startRow: 1, endRow: 1, startCol: 0, endCol: 0 }, activeCell: { rowIndex: 1, columnIndex: 0 } });
    expect(areGridRowPropsEqual(prev, next)).toBe(true);
  });

  // K03: a formula recalc can change any cell's displayed value.
  it('re-renders every row when formulaVersion changes', () => {
    expect(areGridRowPropsEqual(rowProps({ formulaVersion: 1 }), rowProps({ formulaVersion: 2 }))).toBe(false);
  });

  // D13
  it('re-renders when the row-number column is toggled', () => {
    expect(areGridRowPropsEqual(rowProps({ hasRowNumbersCol: false }), rowProps({ hasRowNumbersCol: true }))).toBe(false);
  });

  it('re-renders when the row-number offset changes', () => {
    expect(areGridRowPropsEqual(rowProps({ rowNumberOffset: 0 }), rowProps({ rowNumberOffset: 25 }))).toBe(false);
  });

  it('compares render inputs it does not declare (callbacks, spacer widths, row-number width) by identity', () => {
    expect(areGridRowPropsEqual(rowProps({ renderCellContent }), rowProps({ renderCellContent: () => null }))).toBe(false);
    expect(areGridRowPropsEqual(rowProps({ rowNumWidth: 50 }), rowProps({ rowNumWidth: 80 }))).toBe(false);
    expect(areGridRowPropsEqual(rowProps({ leftSpacerWidth: 0 }), rowProps({ leftSpacerWidth: 120 }))).toBe(false);
  });

  it('re-renders when a prop is added or removed', () => {
    expect(areGridRowPropsEqual(rowProps(), rowProps({ popoverAnchorEl: {} }))).toBe(false);
    expect(areGridRowPropsEqual(rowProps({ popoverAnchorEl: {} }), rowProps())).toBe(false);
  });

  it('re-renders the active row when drag-selecting starts (active highlight is hidden while dragging)', () => {
    const activeCell = { rowIndex: 2, columnIndex: 0 };
    const sel = { startRow: 2, endRow: 4, startCol: 0, endCol: 0 };
    expect(areGridRowPropsEqual(
      rowProps({ activeCell, selectionRange: sel, isDragging: false }),
      rowProps({ activeCell, selectionRange: sel, isDragging: true }),
    )).toBe(false);
  });

  it('re-renders a row when a single-cell selection grows into a multi-row range covering it', () => {
    expect(areGridRowPropsEqual(
      rowProps({ selectionRange: { startRow: 2, endRow: 2, startCol: 0, endCol: 0 } }),
      rowProps({ selectionRange: { startRow: 1, endRow: 2, startCol: 0, endCol: 0 } }),
    )).toBe(false);
  });

  it('re-renders the selection end row when a copy range elsewhere is cleared (fill handle returns)', () => {
    const sel = { startRow: 2, endRow: 2, startCol: 0, endCol: 0 };
    expect(areGridRowPropsEqual(
      rowProps({ selectionRange: sel, copyRange: { startRow: 7, endRow: 8, startCol: 0, endCol: 0 } }),
      rowProps({ selectionRange: sel, copyRange: null }),
    )).toBe(false);
  });

  it('re-renders the row entering or leaving edit mode, not other rows', () => {
    expect(areGridRowPropsEqual(rowProps({ editingRowId: null }), rowProps({ editingRowId: 'r2' }))).toBe(false);
    expect(areGridRowPropsEqual(rowProps({ editingRowId: null }), rowProps({ editingRowId: 'r9' }))).toBe(true);
  });
});
