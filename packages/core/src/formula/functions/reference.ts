import { resolveReference } from '../references';
import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { asArray, checkArraySize } from '../arrays';
import { FormulaError } from '../types';
import { evalArg, toNumber } from '../evaluator';
import { MAX_MATRIX_SIZE } from '../limits';
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
      const refArg = resolveReference(args[0], context);
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

      const refArg = resolveReference(args[0], context);
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
      const arg = resolveReference(args[0], context);
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
      const arg = resolveReference(args[0], context);
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
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const arg = resolveReference(args[0], context);
      if (arg !== undefined && arg.kind === 'range') {
        return Math.abs(arg.end.row - arg.start.row) + 1;
      }
      if (arg !== undefined && arg.kind === 'cellRef') {
        return 1;
      }
      const value = evalArg(evaluator, arg, context);
      if (value instanceof FormulaError) return value;
      if (Array.isArray(value)) return value.length;
      return new FormulaError('#VALUE!', 'ROWS: argument must be a range reference');
    },
  });

  // ---------------------------------------------------------------------------
  // COLUMNS(array)  -  count columns in a range
  // ---------------------------------------------------------------------------
  registry.set('COLUMNS', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const arg = resolveReference(args[0], context);
      if (arg !== undefined && arg.kind === 'range') {
        return Math.abs(arg.end.col - arg.start.col) + 1;
      }
      if (arg !== undefined && arg.kind === 'cellRef') {
        return 1;
      }
      const value = evalArg(evaluator, arg, context);
      if (value instanceof FormulaError) return value;
      if (Array.isArray(value)) return value[0]?.length ?? 0;
      return new FormulaError('#VALUE!', 'COLUMNS: argument must be a range reference');
    },
  });

  // ---------------------------------------------------------------------------
  // MMULT(array1, array2)  -  matrix multiplication
  // ---------------------------------------------------------------------------
  registry.set('MMULT', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, _evaluator: IEvaluator): unknown {
      const array1Arg = resolveReference(args[0], context);
      if (array1Arg === undefined || array1Arg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'MMULT: array1 must be a range');
      }
      const array2Arg = resolveReference(args[1], context);
      if (array2Arg === undefined || array2Arg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'MMULT: array2 must be a range');
      }

      const a = asArray(_evaluator.evaluate(array1Arg, context)), b = asArray(_evaluator.evaluate(array2Arg, context));
      const width = a[0]?.length ?? 0, cols = b[0]?.length ?? 0;
      if (!width || width !== b.length) return new FormulaError('#VALUE!', 'MMULT dimensions do not match');
      checkArraySize(a.length, cols, context);
      context.consumeWork?.(a.length * cols * width);
      const result: unknown[][] = [];
      for (const row of a) {
        const out: unknown[] = [];
        for (let c = 0; c < cols; c++) {
          let sum = 0;
          for (let k = 0; k < width; k++) {
            const left = toNumber(row[k]), right = toNumber(b[k]?.[c]);
            if (left instanceof FormulaError) return left;
            if (right instanceof FormulaError) return right;
            sum += left * right;
          }
          out.push(Number.isFinite(sum) ? sum : new FormulaError('#NUM!'));
        }
        result.push(out);
      }
      return result;
    },
  });

  // ---------------------------------------------------------------------------
  // MDETERM(array)  -  matrix determinant
  // ---------------------------------------------------------------------------
  registry.set('MDETERM', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, _evaluator: IEvaluator): unknown {
      const arrayArg = resolveReference(args[0], context);
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
      const arrayArg = resolveReference(args[0], context);
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
function matrixInverse(m: number[][], n: number): number[][] | FormulaError {
  // Augment with identity matrix
  const aug: number[][] = [];
  for (let r = 0; r < n; r++) {
    const srcRow = m[r];
    if (srcRow === undefined) continue; // unreachable: r < n and m is n x n
    const row: number[] = [...srcRow];
    for (let c = 0; c < n; c++) row.push(r === c ? 1 : 0);
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
    for (let c = 0; c < n * 2; c++) {
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
        for (let c = 0; c < n * 2; c++) {
          const rv = rowArr[c];
          const pv = pivotArr[c];
          if (rv !== undefined && pv !== undefined) {
            rowArr[c] = rv - factor * pv;
          }
        }
      }
    }
  }

  return aug.map(row => row.slice(n));
}
