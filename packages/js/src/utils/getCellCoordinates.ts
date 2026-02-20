/**
 * Extracts row and column indices from a cell element's data attributes.
 * Returns null if the element lacks the attributes or they are not valid numbers.
 */
export function getCellCoordinates(cell: Element): { rowIndex: number; colIndex: number } | null {
  const rowStr = cell.getAttribute('data-row-index');
  const colStr = cell.getAttribute('data-col-index');
  if (rowStr == null || colStr == null) return null;
  const rowIndex = parseInt(rowStr, 10);
  const colIndex = parseInt(colStr, 10);
  if (Number.isNaN(rowIndex) || Number.isNaN(colIndex)) return null;
  return { rowIndex, colIndex };
}
