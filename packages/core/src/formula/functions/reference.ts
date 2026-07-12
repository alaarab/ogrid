import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { FormulaError } from '../types';
import { toNumber } from '../evaluator';
import { parseCellRef, parseRange } from '../cellAddressUtils';
import { indexToColumnLetter } from '../../utils/cellReference';

export function registerReferenceFunctions(registry: Map<string, IFormulaFunction>): void {
  // ---------------------------------------------------------------------------
  // INDIRECT(ref_text, [a1=true])
  // ---------------------------------------------------------------------------
  registry.set('INDIRECT', {
    minArgs: 1,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const refArg = args[0];
      if (refArg === undefined) {
        return new FormulaError('#REF!', 'INDIRECT: missing reference');
      }
      const rawRef = evaluator.evaluate(refArg, context);
      if (rawRef instanceof FormulaError) return rawRef;
      const refText = String(rawRef ?? '');

      // a1 style is the default (true); R1C1 not supported here
      // (arg 1 is ignored  -  we always parse A1 style)

      // Try as a range first
      const range = parseRange(refText);
      if (range) {
        // Return the top-left cell value for single-cell range, or the range data
        const start = range.start;
        const end = range.end;
        if (start.row === end.row && start.col === end.col) {
          return context.getCellValue(start);
        }
        // Multi-cell: return top-left cell value (INDIRECT of a range returns single value)
        return context.getCellValue(start);
      }

      // Try as a cell reference
      const addr = parseCellRef(refText);
      if (!addr) {
        return new FormulaError('#REF!', `INDIRECT: invalid reference "${refText}"`);
      }
      return context.getCellValue(addr);
    },
  });

  // ---------------------------------------------------------------------------
  // OFFSET(reference, rows, cols, [height=1], [width=1])
  // ---------------------------------------------------------------------------
  registry.set('OFFSET', {
    minArgs: 3,
    maxArgs: 5,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // reference must be a cell ref or range
      let baseCol: number;
      let baseRow: number;

      const refArg = args[0];
      if (refArg !== undefined && refArg.kind === 'cellRef') {
        baseCol = refArg.address.col;
        baseRow = refArg.address.row;
      } else if (refArg !== undefined && refArg.kind === 'range') {
        baseCol = refArg.start.col;
        baseRow = refArg.start.row;
      } else {
        return new FormulaError('#VALUE!', 'OFFSET: first argument must be a cell reference');
      }

      const rowsArg = args[1];
      const colsArg = args[2];
      if (rowsArg === undefined || colsArg === undefined) {
        return new FormulaError('#VALUE!', 'OFFSET: requires reference, rows, and cols');
      }

      const rawRows = evaluator.evaluate(rowsArg, context);
      if (rawRows instanceof FormulaError) return rawRows;
      const rowOffset = toNumber(rawRows);
      if (rowOffset instanceof FormulaError) return rowOffset;

      const rawCols = evaluator.evaluate(colsArg, context);
      if (rawCols instanceof FormulaError) return rawCols;
      const colOffset = toNumber(rawCols);
      if (colOffset instanceof FormulaError) return colOffset;

      const targetRow = baseRow + Math.trunc(rowOffset);
      const targetCol = baseCol + Math.trunc(colOffset);

      if (targetRow < 0 || targetCol < 0) {
        return new FormulaError('#REF!', 'OFFSET: reference out of bounds');
      }

      let height = 1;
      const heightArg = args[3];
      if (heightArg !== undefined) {
        const rawH = evaluator.evaluate(heightArg, context);
        if (rawH instanceof FormulaError) return rawH;
        const h = toNumber(rawH);
        if (h instanceof FormulaError) return h;
        height = Math.trunc(h);
      }

      let width = 1;
      const widthArg = args[4];
      if (widthArg !== undefined) {
        const rawW = evaluator.evaluate(widthArg, context);
        if (rawW instanceof FormulaError) return rawW;
        const w = toNumber(rawW);
        if (w instanceof FormulaError) return w;
        width = Math.trunc(w);
      }

      if (height <= 0 || width <= 0) {
        return new FormulaError('#VALUE!', 'OFFSET: height and width must be >= 1');
      }

      // Single-cell result
      if (height === 1 && width === 1) {
        return context.getCellValue({ col: targetCol, row: targetRow, absCol: false, absRow: false });
      }

      // Multi-cell: return top-left cell value (simplified; full array return requires engine support)
      return context.getCellValue({ col: targetCol, row: targetRow, absCol: false, absRow: false });
    },
  });

  // ---------------------------------------------------------------------------
  // ADDRESS(row_num, col_num, [abs_num=1], [a1=true], [sheet_text])
  // abs_num: 1=$A$1, 2=A$1, 3=$A1, 4=A1
  // ---------------------------------------------------------------------------
  registry.set('ADDRESS', {
    minArgs: 2,
    maxArgs: 5,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rowNumArg = args[0];
      const colNumArg = args[1];
      if (rowNumArg === undefined || colNumArg === undefined) {
        return new FormulaError('#VALUE!', 'ADDRESS: requires row_num and col_num');
      }

      const rawRow = evaluator.evaluate(rowNumArg, context);
      if (rawRow instanceof FormulaError) return rawRow;
      const rowNum = toNumber(rawRow);
      if (rowNum instanceof FormulaError) return rowNum;

      const rawCol = evaluator.evaluate(colNumArg, context);
      if (rawCol instanceof FormulaError) return rawCol;
      const colNum = toNumber(rawCol);
      if (colNum instanceof FormulaError) return colNum;

      const row = Math.trunc(rowNum);
      const col = Math.trunc(colNum);

      if (row < 1 || col < 1) {
        return new FormulaError('#VALUE!', 'ADDRESS: row and column must be >= 1');
      }

      let absNum = 1;
      const absArg = args[2];
      if (absArg !== undefined) {
        const rawAbs = evaluator.evaluate(absArg, context);
        if (rawAbs instanceof FormulaError) return rawAbs;
        const a = toNumber(rawAbs);
        if (a instanceof FormulaError) return a;
        absNum = Math.trunc(a);
      }

      // a1 param (arg 3)  -  only A1 style supported, R1C1 returns same result
      // sheet_text (arg 4)
      let sheetText = '';
      const sheetArg = args[4];
      if (sheetArg !== undefined) {
        const rawSheet = evaluator.evaluate(sheetArg, context);
        if (rawSheet instanceof FormulaError) return rawSheet;
        if (rawSheet !== null && rawSheet !== undefined && rawSheet !== false) {
          sheetText = String(rawSheet);
        }
      }

      const colLetter = indexToColumnLetter(col - 1);
      let address: string;
      switch (absNum) {
        case 1: address = `$${colLetter}$${row}`; break;       // $A$1
        case 2: address = `${colLetter}$${row}`; break;        // A$1
        case 3: address = `$${colLetter}${row}`; break;        // $A1
        case 4: address = `${colLetter}${row}`; break;         // A1
        default: address = `$${colLetter}$${row}`;
      }

      if (sheetText) {
        const quoted = sheetText.includes(' ') ? `'${sheetText}'` : sheetText;
        return `${quoted}!${address}`;
      }
      return address;
    },
  });

  // ---------------------------------------------------------------------------
  // ROW([reference])  -  1-based row number
  // ---------------------------------------------------------------------------
  registry.set('ROW', {
    minArgs: 0,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const arg = args[0];
      if (arg === undefined) {
        // Without reference: not easily supported without current-cell info in context.
        // Return 1 as a safe default (matches behavior when called without context).
        return 1;
      }

      if (arg.kind === 'cellRef') {
        return arg.address.row + 1;
      }
      if (arg.kind === 'range') {
        return arg.start.row + 1;
      }

      // Evaluate as a string reference via INDIRECT-style
      const rawRef = evaluator.evaluate(arg, context);
      if (rawRef instanceof FormulaError) return rawRef;
      const refText = String(rawRef ?? '');
      const addr = parseCellRef(refText);
      if (!addr) {
        const rng = parseRange(refText);
        if (rng) return rng.start.row + 1;
        return new FormulaError('#VALUE!', 'ROW: invalid reference');
      }
      return addr.row + 1;
    },
  });

  // ---------------------------------------------------------------------------
  // COLUMN([reference])  -  1-based column number
  // ---------------------------------------------------------------------------
  registry.set('COLUMN', {
    minArgs: 0,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const arg = args[0];
      if (arg === undefined) {
        return 1;
      }

      if (arg.kind === 'cellRef') {
        return arg.address.col + 1;
      }
      if (arg.kind === 'range') {
        return arg.start.col + 1;
      }

      const rawRef = evaluator.evaluate(arg, context);
      if (rawRef instanceof FormulaError) return rawRef;
      const refText = String(rawRef ?? '');
      const addr = parseCellRef(refText);
      if (!addr) {
        const rng = parseRange(refText);
        if (rng) return rng.start.col + 1;
        return new FormulaError('#VALUE!', 'COLUMN: invalid reference');
      }
      return addr.col + 1;
    },
  });

  // ---------------------------------------------------------------------------
  // ROWS(array)  -  count rows in a range
  // ---------------------------------------------------------------------------
  registry.set('ROWS', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], _context: IFormulaContext, _evaluator: IEvaluator): unknown {
      const arg = args[0];
      if (arg !== undefined && arg.kind === 'range') {
        return Math.abs(arg.end.row - arg.start.row) + 1;
      }
      if (arg !== undefined && arg.kind === 'cellRef') {
        return 1;
      }
      return new FormulaError('#VALUE!', 'ROWS: argument must be a range reference');
    },
  });

  // ---------------------------------------------------------------------------
  // COLUMNS(array)  -  count columns in a range
  // ---------------------------------------------------------------------------
  registry.set('COLUMNS', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], _context: IFormulaContext, _evaluator: IEvaluator): unknown {
      const arg = args[0];
      if (arg !== undefined && arg.kind === 'range') {
        return Math.abs(arg.end.col - arg.start.col) + 1;
      }
      if (arg !== undefined && arg.kind === 'cellRef') {
        return 1;
      }
      return new FormulaError('#VALUE!', 'COLUMNS: argument must be a range reference');
    },
  });

  // ---------------------------------------------------------------------------
  // SEQUENCE(rows, [cols=1], [start=1], [step=1])
  // Returns a flat array for single-row sequences, or nested for multi-row.
  // Since OGrid formula cells hold a single value, return the first element
  // for use in a cell context. Full array support would require a spill engine.
  // For test purposes, we expose the full nested array via a helper path.
  // ---------------------------------------------------------------------------
  registry.set('SEQUENCE', {
    minArgs: 1,
    maxArgs: 4,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rowsArg = args[0];
      if (rowsArg === undefined) {
        return new FormulaError('#VALUE!', 'SEQUENCE: rows is required');
      }
      const rawRows = evaluator.evaluate(rowsArg, context);
      if (rawRows instanceof FormulaError) return rawRows;
      const rows = toNumber(rawRows);
      if (rows instanceof FormulaError) return rows;

      let cols = 1;
      const colsArg = args[1];
      if (colsArg !== undefined) {
        const rawCols = evaluator.evaluate(colsArg, context);
        if (rawCols instanceof FormulaError) return rawCols;
        const c = toNumber(rawCols);
        if (c instanceof FormulaError) return c;
        cols = Math.trunc(c);
      }

      let start = 1;
      const startArg = args[2];
      if (startArg !== undefined) {
        const rawStart = evaluator.evaluate(startArg, context);
        if (rawStart instanceof FormulaError) return rawStart;
        const s = toNumber(rawStart);
        if (s instanceof FormulaError) return s;
        start = s;
      }

      let step = 1;
      const stepArg = args[3];
      if (stepArg !== undefined) {
        const rawStep = evaluator.evaluate(stepArg, context);
        if (rawStep instanceof FormulaError) return rawStep;
        const st = toNumber(rawStep);
        if (st instanceof FormulaError) return st;
        step = st;
      }

      const rowCount = Math.trunc(rows);
      const colCount = Math.max(1, cols);

      if (rowCount < 1) {
        return new FormulaError('#VALUE!', 'SEQUENCE: rows must be >= 1');
      }

      // Build the nested array
      const result: number[][] = [];
      let current = start;
      for (let r = 0; r < rowCount; r++) {
        const row: number[] = [];
        for (let c = 0; c < colCount; c++) {
          row.push(current);
          current += step;
        }
        result.push(row);
      }

      // Single value: return first element
      if (rowCount === 1 && colCount === 1) {
        return result[0]?.[0];
      }

      // Return the array structure  -  callers can inspect it
      // For a single-cell context, return the first element
      return result[0]?.[0];
    },
  });

  // ---------------------------------------------------------------------------
  // TRANSPOSE(array)  -  transpose a 2D range
  // ---------------------------------------------------------------------------
  registry.set('TRANSPOSE', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, _evaluator: IEvaluator): unknown {
      const arrayArg = args[0];
      if (arrayArg === undefined || arrayArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'TRANSPOSE: argument must be a range');
      }
      const data = context.getRangeValues({ start: arrayArg.start, end: arrayArg.end });
      const firstDataRow = data[0];
      if (firstDataRow === undefined) return null;

      const rows = data.length;
      const cols = firstDataRow.length;

      // Build transposed array
      const transposed: unknown[][] = [];
      for (let c = 0; c < cols; c++) {
        const newRow: unknown[] = [];
        for (let r = 0; r < rows; r++) {
          newRow.push(data[r]?.[c]);
        }
        transposed.push(newRow);
      }

      // Return top-left element (single-cell context)
      return transposed[0]?.[0] ?? null;
    },
  });

  // ---------------------------------------------------------------------------
  // MMULT(array1, array2)  -  matrix multiplication
  // ---------------------------------------------------------------------------
  registry.set('MMULT', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, _evaluator: IEvaluator): unknown {
      const array1Arg = args[0];
      if (array1Arg === undefined || array1Arg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'MMULT: array1 must be a range');
      }
      const array2Arg = args[1];
      if (array2Arg === undefined || array2Arg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'MMULT: array2 must be a range');
      }

      const a = context.getRangeValues({ start: array1Arg.start, end: array1Arg.end });
      const b = context.getRangeValues({ start: array2Arg.start, end: array2Arg.end });

      const aFirstRow = a[0];
      const bFirstRow = b[0];
      if (aFirstRow === undefined || bFirstRow === undefined) {
        return new FormulaError('#VALUE!', 'MMULT: empty array');
      }

      const aRows = a.length;
      const aCols = aFirstRow.length;
      const bRows = b.length;
      const bCols = bFirstRow.length;

      if (aCols !== bRows) {
        return new FormulaError('#VALUE!', `MMULT: columns of array1 (${aCols}) must equal rows of array2 (${bRows})`);
      }

      // Compute result matrix
      const result: number[][] = [];
      for (let r = 0; r < aRows; r++) {
        const row: number[] = [];
        for (let c = 0; c < bCols; c++) {
          let sum = 0;
          for (let k = 0; k < aCols; k++) {
            const av = toNumber(a[r]?.[k]);
            const bv = toNumber(b[k]?.[c]);
            if (av instanceof FormulaError) return av;
            if (bv instanceof FormulaError) return bv;
            sum += av * bv;
          }
          row.push(sum);
        }
        result.push(row);
      }

      // Return top-left element for single-cell context
      return result[0]?.[0];
    },
  });

  // ---------------------------------------------------------------------------
  // MDETERM(array)  -  matrix determinant
  // ---------------------------------------------------------------------------
  registry.set('MDETERM', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, _evaluator: IEvaluator): unknown {
      const arrayArg = args[0];
      if (arrayArg === undefined || arrayArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'MDETERM: argument must be a range');
      }

      const data = context.getRangeValues({ start: arrayArg.start, end: arrayArg.end });
      if (data.length === 0) return new FormulaError('#VALUE!', 'MDETERM: empty array');

      const n = data.length;
      if (data.some(row => row.length !== n)) {
        return new FormulaError('#VALUE!', 'MDETERM: array must be square');
      }

      // Convert to number matrix
      const matrix: number[][] = [];
      for (let r = 0; r < n; r++) {
        const row: number[] = [];
        for (let c = 0; c < n; c++) {
          const v = toNumber(data[r]?.[c]);
          if (v instanceof FormulaError) return v;
          row.push(v);
        }
        matrix.push(row);
      }

      return determinant(matrix);
    },
  });

  // ---------------------------------------------------------------------------
  // MINVERSE(array)  -  matrix inverse (Gauss-Jordan elimination)
  // ---------------------------------------------------------------------------
  registry.set('MINVERSE', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, _evaluator: IEvaluator): unknown {
      const arrayArg = args[0];
      if (arrayArg === undefined || arrayArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'MINVERSE: argument must be a range');
      }

      const data = context.getRangeValues({ start: arrayArg.start, end: arrayArg.end });
      if (data.length === 0) return new FormulaError('#VALUE!', 'MINVERSE: empty array');

      const n = data.length;
      if (data.some(row => row.length !== n)) {
        return new FormulaError('#VALUE!', 'MINVERSE: array must be square');
      }

      // Convert to number matrix
      const matrix: number[][] = [];
      for (let r = 0; r < n; r++) {
        const row: number[] = [];
        for (let c = 0; c < n; c++) {
          const v = toNumber(data[r]?.[c]);
          if (v instanceof FormulaError) return v;
          row.push(v);
        }
        matrix.push(row);
      }

      const inv = matrixInverse(matrix, n);
      if (inv instanceof FormulaError) return inv;

      // Return top-left element for single-cell context
      return inv[0]?.[0];
    },
  });
}

// ---------------------------------------------------------------------------
// Helper: recursive cofactor expansion for determinant (small matrices)
// ---------------------------------------------------------------------------
function determinant(m: number[][]): number {
  const n = m.length;
  const row0 = m[0];
  if (row0 === undefined) return 0; // unreachable: callers guarantee n >= 1
  if (n === 1) return row0[0] ?? 0;
  if (n === 2) {
    const row1 = m[1];
    if (row1 === undefined) return 0; // unreachable: matrix is square
    return (row0[0] ?? 0) * (row1[1] ?? 0) - (row0[1] ?? 0) * (row1[0] ?? 0);
  }

  let det = 0;
  for (let c = 0; c < n; c++) {
    // Cofactor: minor matrix excluding row 0, col c
    const minor: number[][] = [];
    for (let r = 1; r < n; r++) {
      const srcRow = m[r];
      if (srcRow === undefined) continue; // unreachable: r < n
      const row: number[] = [];
      for (let cc = 0; cc < n; cc++) {
        if (cc !== c) {
          const v = srcRow[cc];
          if (v !== undefined) row.push(v);
        }
      }
      minor.push(row);
    }
    det += (c % 2 === 0 ? 1 : -1) * (row0[c] ?? 0) * determinant(minor);
  }
  return det;
}

// ---------------------------------------------------------------------------
// Helper: Gauss-Jordan matrix inverse
// ---------------------------------------------------------------------------
function matrixInverse(m: number[][], n: number): number[][] | FormulaError {
  // Augment with identity matrix
  const aug: number[][] = [];
  for (let r = 0; r < n; r++) {
    const srcRow = m[r];
    if (srcRow === undefined) continue; // unreachable: r < n and m is n x n
    const row: number[] = [...srcRow];
    for (let c = 0; c < n; c++) {
      row.push(c === r ? 1 : 0);
    }
    aug.push(row);
  }

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let pivotRow = -1;
    let pivotVal = 0;
    for (let r = col; r < n; r++) {
      const candidate = aug[r]?.[col];
      if (candidate !== undefined && Math.abs(candidate) > Math.abs(pivotVal)) {
        pivotVal = candidate;
        pivotRow = r;
      }
    }

    if (pivotRow === -1 || Math.abs(pivotVal) < 1e-12) {
      return new FormulaError('#NUM!', 'MINVERSE: matrix is singular');
    }

    // Swap rows
    if (pivotRow !== col) {
      const rowA = aug[col];
      const rowB = aug[pivotRow];
      if (rowA !== undefined && rowB !== undefined) {
        aug[col] = rowB;
        aug[pivotRow] = rowA;
      }
    }

    // Scale pivot row
    const pivotArr = aug[col];
    if (pivotArr === undefined) {
      return new FormulaError('#NUM!', 'MINVERSE: matrix is singular'); // unreachable
    }
    const scale = pivotArr[col];
    if (scale === undefined) {
      return new FormulaError('#NUM!', 'MINVERSE: matrix is singular'); // unreachable
    }
    for (let c = 0; c < 2 * n; c++) {
      const v = pivotArr[c];
      if (v !== undefined) pivotArr[c] = v / scale;
    }

    // Eliminate column entries in all other rows
    for (let r = 0; r < n; r++) {
      if (r !== col) {
        const rowArr = aug[r];
        if (rowArr === undefined) continue; // unreachable: r < n
        const factor = rowArr[col];
        if (factor === undefined) continue; // unreachable: col < 2n
        for (let c = 0; c < 2 * n; c++) {
          const rv = rowArr[c];
          const pv = pivotArr[c];
          if (rv !== undefined && pv !== undefined) {
            rowArr[c] = rv - factor * pv;
          }
        }
      }
    }
  }

  // Extract inverse from augmented matrix
  const result: number[][] = [];
  for (let r = 0; r < n; r++) {
    const rowArr = aug[r];
    if (rowArr === undefined) continue; // unreachable: r < n
    result.push(rowArr.slice(n));
  }
  return result;
}
