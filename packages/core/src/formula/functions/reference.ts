import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { FormulaError } from '../types';
import { toNumber } from '../evaluator';
import { MAX_MATRIX_SIZE, MAX_RANGE_CELLS } from '../limits';
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
        return context.getRangeValues(range);
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

      if (!Number.isFinite(height) || !Number.isFinite(width) || height <= 0 || width <= 0) {
        return new FormulaError('#VALUE!', 'OFFSET: height and width must be >= 1');
      }

      const sheetName = refArg?.kind === 'cellRef' ? refArg.address.sheet : refArg?.kind === 'range' ? refArg.start.sheet : undefined;
      if (!Number.isSafeInteger(targetRow) || !Number.isSafeInteger(targetCol) || targetRow + height > 1048576 || targetCol + width > 16384) return new FormulaError('#REF!', 'OFFSET out of bounds');
      // Single-cell result
      if (height === 1 && width === 1) {
        return context.getCellValue({ col: targetCol, row: targetRow, absCol: false, absRow: false, sheet: sheetName });
      }

      const sheet = refArg?.kind === 'cellRef' ? refArg.address.sheet : refArg?.kind === 'range' ? refArg.start.sheet : undefined;
      if (!Number.isSafeInteger(targetRow) || !Number.isSafeInteger(targetCol) || targetRow + height > 1048576 || targetCol + width > 16384) return new FormulaError('#REF!', 'OFFSET out of bounds');
      return context.getRangeValues({
        start: { col: targetCol, row: targetRow, absCol: false, absRow: false, sheet },
        end: { col: targetCol + width - 1, row: targetRow + height - 1, absCol: false, absRow: false, sheet },
      });
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

      if (!Number.isSafeInteger(row) || !Number.isSafeInteger(col) || row < 1 || col < 1 || row > 1048576 || col > 16384) {
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
        const quoted = /^[A-Za-z_][A-Za-z0-9_]*$/.test(sheetText) ? sheetText : `'${sheetText.replace(/'/g, "''")}'`;
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
        return (context.currentCell?.row ?? 0) + 1;
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
        return (context.currentCell?.col ?? 0) + 1;
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

      // step is validated for error propagation; it can't affect the first element.
      const stepArg = args[3];
      if (stepArg !== undefined) {
        const rawStep = evaluator.evaluate(stepArg, context);
        if (rawStep instanceof FormulaError) return rawStep;
        const st = toNumber(rawStep);
        if (st instanceof FormulaError) return st;
      }

      const rowCount = Math.trunc(rows);
      const colCount = Math.max(1, cols);

      if (rowCount < 1) {
        return new FormulaError('#VALUE!', 'SEQUENCE: rows must be >= 1');
      }

      // A formula cell holds a single value (no spill engine), so the result
      // is the sequence's first element. Don't materialise the whole array:
      // =SEQUENCE(1e9) would otherwise exhaust memory.
      if (!Number.isFinite(rowCount) || !Number.isFinite(colCount)) {
        return new FormulaError('#NUM!', 'SEQUENCE: size must be finite');
      }
      return start;
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
      return context.getCellValue({ ...arrayArg.start, col: Math.min(arrayArg.start.col, arrayArg.end.col), row: Math.min(arrayArg.start.row, arrayArg.end.row) });
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

      const aCols = Math.abs(array1Arg.end.col - array1Arg.start.col) + 1;
      const bRows = Math.abs(array2Arg.end.row - array2Arg.start.row) + 1;
      if (aCols !== bRows) return new FormulaError('#VALUE!', 'MMULT dimensions do not match');
      if (aCols > MAX_RANGE_CELLS) return new FormulaError('#VALUE!', 'MMULT too large');
      let sum = 0;
      const aCol = Math.min(array1Arg.start.col, array1Arg.end.col);
      const aRow = Math.min(array1Arg.start.row, array1Arg.end.row);
      const bCol = Math.min(array2Arg.start.col, array2Arg.end.col);
      const bRow = Math.min(array2Arg.start.row, array2Arg.end.row);
      for (let k = 0; k < aCols; k++) {
        const av = toNumber(context.getCellValue({ ...array1Arg.start, col: aCol + k, row: aRow }));
        const bv = toNumber(context.getCellValue({ ...array2Arg.start, col: bCol, row: bRow + k }));
        if (av instanceof FormulaError) return av;
        if (bv instanceof FormulaError) return bv;
        sum += av * bv;
      }
      return sum;
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

      const size = Math.abs(arrayArg.end.row - arrayArg.start.row) + 1;
      if (size > MAX_MATRIX_SIZE || Math.abs(arrayArg.end.col - arrayArg.start.col) + 1 > MAX_MATRIX_SIZE) return new FormulaError('#VALUE!', 'Matrix too large');
      const data = context.getRangeValues({ start: arrayArg.start, end: arrayArg.end });

      const n = size;
      if (Math.abs(arrayArg.end.col - arrayArg.start.col) + 1 !== n) {
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

      const size = Math.abs(arrayArg.end.row - arrayArg.start.row) + 1;
      if (size > MAX_MATRIX_SIZE || Math.abs(arrayArg.end.col - arrayArg.start.col) + 1 > MAX_MATRIX_SIZE) return new FormulaError('#VALUE!', 'Matrix too large');
      const data = context.getRangeValues({ start: arrayArg.start, end: arrayArg.end });

      const n = size;
      if (Math.abs(arrayArg.end.col - arrayArg.start.col) + 1 !== n) {
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

      return matrixInverse(matrix, n);
    },
  });
}

// ---------------------------------------------------------------------------
// Helper: elimination with partial pivoting, O(n^3).
// ---------------------------------------------------------------------------
function determinant(m: number[][]): number {
  let result = 1;
  for (let col = 0; col < m.length; col++) {
    let pivot = col;
    for (let row = col + 1; row < m.length; row++) if (Math.abs(m[row]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) pivot = row;
    if ((m[pivot]?.[col] ?? 0) === 0) return 0;
    if (pivot !== col) {
      const a = m[col];
      const b = m[pivot];
      if (!a || !b) return 0;
      m[col] = b; m[pivot] = a; result = -result;
    }
    const pivotRow = m[col];
    if (!pivotRow) return 0;
    const value = pivotRow[col] ?? 0;
    result *= value;
    for (let row = col + 1; row < m.length; row++) {
      const target = m[row];
      if (!target) continue;
      const factor = (target[col] ?? 0) / value;
      for (let c = col + 1; c < m.length; c++) target[c] = (target[c] ?? 0) - factor * (pivotRow[c] ?? 0);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helper: Gauss-Jordan matrix inverse
// ---------------------------------------------------------------------------
function matrixInverse(m: number[][], n: number): number | FormulaError {
  // Augment with identity matrix
  const aug: number[][] = [];
  for (let r = 0; r < n; r++) {
    const srcRow = m[r];
    if (srcRow === undefined) continue; // unreachable: r < n and m is n x n
    const row: number[] = [...srcRow];
    row.push(r === 0 ? 1 : 0);
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
    for (let c = 0; c < n + 1; c++) {
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
        for (let c = 0; c < n + 1; c++) {
          const rv = rowArr[c];
          const pv = pivotArr[c];
          if (rv !== undefined && pv !== undefined) {
            rowArr[c] = rv - factor * pv;
          }
        }
      }
    }
  }

  return aug[0]?.[n] ?? new FormulaError('#NUM!', 'Singular matrix');
}
