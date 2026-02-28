/**
 * Excel-style cell reference utilities.
 *
 * Column letters use base-26 encoding: A–Z, AA–AZ, BA–BZ, …
 * Row numbers are 1-based.
 */

/**
 * Convert a 0-based column index to an Excel-style column letter.
 * @example indexToColumnLetter(0)   // 'A'
 * @example indexToColumnLetter(25)  // 'Z'
 * @example indexToColumnLetter(26)  // 'AA'
 * @example indexToColumnLetter(702) // 'AAA'
 */
export function indexToColumnLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/**
 * Parse a column letter string to a 0-based index.
 * @example columnLetterToIndex('A')  // 0
 * @example columnLetterToIndex('Z')  // 25
 * @example columnLetterToIndex('AA') // 26
 * @example columnLetterToIndex('AZ') // 51
 */
export function columnLetterToIndex(letters: string): number {
  let result = 0;
  const upper = letters.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    result = result * 26 + (upper.charCodeAt(i) - 64);
  }
  return result - 1;
}

/**
 * Format a cell reference string from a 0-based column index and a 1-based row number.
 * @example formatCellReference(0, 1)    // 'A1'
 * @example formatCellReference(2, 15)   // 'C15'
 * @example formatCellReference(26, 100) // 'AA100'
 */
export function formatCellReference(colIndex: number, rowNumber: number): string {
  return `${indexToColumnLetter(colIndex)}${rowNumber}`;
}
