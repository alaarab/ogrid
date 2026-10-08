import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode, ICellAddress } from '../types';
import { FormulaError } from '../types';
import { wildcard } from '../wildcard';
import { toNumber, compareValues, evalArg } from '../evaluator';

/** A reference argument's bounds, or undefined when the argument isn't a reference. */
function referenceBounds(arg: ASTNode | undefined): { start: ICellAddress; end: ICellAddress; rows: number; cols: number } | undefined {
  if (arg?.kind === 'cellRef') return { start: arg.address, end: arg.address, rows: 1, cols: 1 };
  if (arg?.kind !== 'range') return undefined;
  const start = { ...arg.start, row: Math.min(arg.start.row, arg.end.row), col: Math.min(arg.start.col, arg.end.col) };
  const end = { ...arg.end, row: Math.max(arg.start.row, arg.end.row), col: Math.max(arg.start.col, arg.end.col) };
  return { start, end, rows: end.row - start.row + 1, cols: end.col - start.col + 1 };
}

/** Lookup comparisons: dates as serials, blanks as unmatched, and type-ranked like Excel. */
function lookupKey(value: unknown): unknown {
  if (value instanceof Date) return toNumber(value);
  return value;
}

function sameKind(a: unknown, b: unknown): boolean {
  return a !== null && a !== undefined && typeof a === typeof b;
}

export function registerLookupFunctions(registry: Map<string, IFormulaFunction>): void {
  // LOOKUP(lookup_value, lookup_vector, [result_vector]) and the array form
  // LOOKUP(lookup_value, array). Approximate match: the last value of the same
  // type that is <= lookup_value (data is expected to be sorted ascending), so
  // LOOKUP(9.99E+307, A:A) finds the last number as in Excel. With a 2D array
  // and no result_vector, a wider-than-tall array searches its first row and
  // returns from the last row; otherwise the first column and the last column.
  registry.set('LOOKUP', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawLookup = evalArg(evaluator, args[0], context);
      if (rawLookup instanceof FormulaError) return rawLookup;
      const lookupValue = lookupKey(rawLookup ?? 0);
      if (lookupValue instanceof FormulaError) return lookupValue;
      const source = referenceBounds(args[1]);
      if (!source) return new FormulaError('#VALUE!', 'LOOKUP lookup_vector must be a reference');
      const resultRef = args.length >= 3 ? referenceBounds(args[2]) : undefined;
      if (args.length >= 3 && !resultRef) return new FormulaError('#VALUE!', 'LOOKUP result_vector must be a reference');
      if (resultRef && resultRef.rows > 1 && resultRef.cols > 1) return new FormulaError('#N/A', 'LOOKUP result_vector must be one row or column');

      const horizontal = source.cols > source.rows;
      const length = horizontal ? source.cols : source.rows;
      const data = context.getRangeValues({ start: source.start, end: source.end });
      let found = -1;
      for (let i = 0; i < length; i++) {
        const cell = lookupKey(horizontal ? data[0]?.[i] : data[i]?.[0]);
        if (!sameKind(cell, lookupValue)) continue;
        if (compareValues(cell, lookupValue) <= 0) found = i;
      }
      if (found < 0) return new FormulaError('#N/A', 'LOOKUP no match found');

      // Read through getCellValue so a short result_vector extends, as Excel's does.
      const target = resultRef ?? source;
      const resultHorizontal = resultRef ? resultRef.rows === 1 && (resultRef.cols > 1 || horizontal) : horizontal;
      const address = resultRef
        ? resultHorizontal ? { ...target.start, col: target.start.col + found } : { ...target.start, row: target.start.row + found }
        : horizontal ? { ...target.start, col: target.start.col + found, row: target.end.row } : { ...target.start, row: target.start.row + found, col: target.end.col };
      return context.getCellValue(address) ?? null;
    },
  });

  // XMATCH(lookup_value, lookup_array, [match_mode=0], [search_mode=1]).
  // match_mode: 0 exact, -1 exact or next smaller, 1 exact or next larger,
  // 2 wildcard (* ? ~). search_mode: 1 first-to-last, -1 last-to-first; the
  // binary modes 2/-2 are accepted and run as a linear first-to-last search,
  // which gives the same answer on sorted data.
  registry.set('XMATCH', {
    minArgs: 2,
    maxArgs: 4,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawLookup = evalArg(evaluator, args[0], context);
      if (rawLookup instanceof FormulaError) return rawLookup;
      const lookupValue = lookupKey(rawLookup ?? 0);
      if (lookupValue instanceof FormulaError) return lookupValue;
      const source = referenceBounds(args[1]);
      if (!source) return new FormulaError('#VALUE!', 'XMATCH lookup_array must be a reference');
      if (source.rows > 1 && source.cols > 1) return new FormulaError('#VALUE!', 'XMATCH lookup_array must be one row or column');
      const modes: number[] = [];
      for (const index of [2, 3]) {
        if (args.length <= index) { modes.push(index === 2 ? 0 : 1); continue; }
        const raw = evalArg(evaluator, args[index], context);
        if (raw instanceof FormulaError) return raw;
        const n = toNumber(raw);
        if (n instanceof FormulaError) return n;
        modes.push(Math.trunc(n));
      }
      const [matchMode = 0, searchMode = 1] = modes;
      if (![0, -1, 1, 2].includes(matchMode)) return new FormulaError('#VALUE!', 'XMATCH match_mode must be 0, -1, 1 or 2');
      if (![1, -1, 2, -2].includes(searchMode)) return new FormulaError('#VALUE!', 'XMATCH search_mode must be 1, -1, 2 or -2');

      const horizontal = source.rows === 1;
      const length = horizontal ? source.cols : source.rows;
      const data = context.getRangeValues({ start: source.start, end: source.end });
      const valueAt = (i: number) => lookupKey(horizontal ? data[0]?.[i] : data[i]?.[0]);
      const pattern = matchMode === 2 && typeof lookupValue === 'string' ? wildcard(lookupValue) : undefined;
      const equals = (cell: unknown): boolean => {
        if (!sameKind(cell, lookupValue)) return false;
        if (pattern) return pattern(cell as string, false, context.consumeWork) >= 0;
        return compareValues(cell, lookupValue) === 0;
      };

      let best = -1;
      let bestValue: unknown;
      const reverse = searchMode === -1;
      for (let step = 0; step < length; step++) {
        const i = reverse ? length - 1 - step : step;
        const cell = valueAt(i);
        if (equals(cell)) return i + 1;
        if ((matchMode !== -1 && matchMode !== 1) || !sameKind(cell, lookupValue)) continue;
        const cmp = compareValues(cell, lookupValue);
        if (cmp * matchMode <= 0) continue; // wrong side of lookup_value
        if (best < 0 || compareValues(cell, bestValue) * matchMode < 0) { best = i; bestValue = cell; }
      }
      return best >= 0 ? best + 1 : new FormulaError('#N/A', 'XMATCH no match found');
    },
  });


  registry.set('VLOOKUP', {
    minArgs: 3,
    maxArgs: 4,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const lookupArg = args[0];
      const tableArg = args[1];
      const colArg = args[2];
      if (lookupArg === undefined || colArg === undefined) {
        return new FormulaError('#VALUE!', 'VLOOKUP requires lookup_value, table_array, and col_index');
      }

      // Arg 0: lookup value
      const lookupValue = evaluator.evaluate(lookupArg, context);
      if (lookupValue instanceof FormulaError) return lookupValue;

      // Arg 1: table range (must be a RangeNode)
      if (tableArg === undefined || tableArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'VLOOKUP table_array must be a range');
      }
      const tableData = context.getRangeValues({ start: tableArg.start, end: tableArg.end });

      // Arg 2: column index (1-based)
      const rawColIndex = evaluator.evaluate(colArg, context);
      if (rawColIndex instanceof FormulaError) return rawColIndex;
      const colIndex = toNumber(rawColIndex);
      if (colIndex instanceof FormulaError) return colIndex;

      if (colIndex < 1) return new FormulaError('#VALUE!', 'VLOOKUP col_index must be >= 1');
      const firstTableRow = tableData[0];
      if (firstTableRow !== undefined && colIndex > firstTableRow.length) {
        return new FormulaError('#REF!', 'VLOOKUP col_index exceeds table columns');
      }

      // Arg 3: range_lookup (default true = approximate match)
      let rangeLookup = true;
      const rlArg = args[3];
      if (rlArg !== undefined) {
        const rawRL = evaluator.evaluate(rlArg, context);
        if (rawRL instanceof FormulaError) return rawRL;
        rangeLookup = !!rawRL;
      }

      const col = Math.trunc(colIndex) - 1;

      // Pre-lowercase the lookup value once (avoid per-row allocation)
      const lookupLower = typeof lookupValue === 'string' ? lookupValue.toLowerCase() : null;
      const match = lookupLower === null ? undefined : wildcard(lookupLower);

      if (rangeLookup) {
        // Approximate match: data assumed sorted ascending in first column
        // Find largest value <= lookupValue
        let bestRow = -1;
        for (let r = 0; r < tableData.length; r++) {
          const cellVal = tableData[r]?.[0];
          if (cellVal === null || cellVal === undefined) continue;
          if (typeof lookupValue === 'number' && typeof cellVal === 'number') {
            if (cellVal <= lookupValue) bestRow = r;
            else break;
          } else if (lookupLower !== null && typeof cellVal === 'string') {
            if (cellVal.toLowerCase() <= lookupLower) bestRow = r;
            else break;
          }
        }
        if (bestRow === -1) return new FormulaError('#N/A', 'VLOOKUP no match found');
        return tableData[bestRow]?.[col] ?? null;
      } else {
        // Exact match
        for (let r = 0; r < tableData.length; r++) {
          const cellVal = tableData[r]?.[0];
          if (lookupLower !== null && typeof cellVal === 'string') {
            if ((match?.(cellVal, false, context.consumeWork) ?? -1) >= 0) {
              return tableData[r]?.[col] ?? null;
            }
          } else if (cellVal === lookupValue) {
            return tableData[r]?.[col] ?? null;
          }
        }
        return new FormulaError('#N/A', 'VLOOKUP no exact match found');
      }
    },
  });

  registry.set('INDEX', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // Arg 0: range
      const rangeArg = args[0];
      if (rangeArg === undefined || rangeArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'INDEX first argument must be a range');
      }


      // Arg 1: row number (1-based)
      const rowArg = args[1];
      if (rowArg === undefined) {
        return new FormulaError('#VALUE!', 'INDEX requires a row number');
      }
      const rawRow = evaluator.evaluate(rowArg, context);
      if (rawRow instanceof FormulaError) return rawRow;
      const rowNum = toNumber(rawRow);
      if (rowNum instanceof FormulaError) return rowNum;

      // Arg 2: column number (1-based, optional, default 1)
      let colNum = 1;
      const colArg = args[2];
      if (colArg !== undefined) {
        const rawCol = evaluator.evaluate(colArg, context);
        if (rawCol instanceof FormulaError) return rawCol;
        const c = toNumber(rawCol);
        if (c instanceof FormulaError) return c;
        colNum = c;
      }

      const rows = Math.abs(rangeArg.end.row - rangeArg.start.row) + 1;
      const cols = Math.abs(rangeArg.end.col - rangeArg.start.col) + 1;
      const horizontal = rows === 1 && colArg === undefined;
      const r = horizontal ? 0 : Math.trunc(rowNum) - 1;
      const c = Math.trunc(horizontal ? rowNum : colNum) - 1;
      if (r < 0 || r >= rows || c < 0 || c >= cols) return new FormulaError('#REF!', 'INDEX out of bounds');
      return context.getCellValue({ ...rangeArg.start, row: Math.min(rangeArg.start.row, rangeArg.end.row) + r, col: Math.min(rangeArg.start.col, rangeArg.end.col) + c }) ?? null;
    },
  });

  registry.set('HLOOKUP', {
    minArgs: 3,
    maxArgs: 4,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const lookupArg = args[0];
      const tableArg = args[1];
      const rowIdxArg = args[2];
      if (lookupArg === undefined || rowIdxArg === undefined) {
        return new FormulaError('#VALUE!', 'HLOOKUP requires lookup_value, table_array, and row_index');
      }
      const lookupValue = evaluator.evaluate(lookupArg, context);
      if (lookupValue instanceof FormulaError) return lookupValue;
      if (tableArg === undefined || tableArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'HLOOKUP table_array must be a range');
      }
      const tableData = context.getRangeValues({ start: tableArg.start, end: tableArg.end });
      const rawRowIndex = evaluator.evaluate(rowIdxArg, context);
      if (rawRowIndex instanceof FormulaError) return rawRowIndex;
      const rowIndex = toNumber(rawRowIndex);
      if (rowIndex instanceof FormulaError) return rowIndex;
      if (rowIndex < 1) return new FormulaError('#VALUE!', 'HLOOKUP row_index must be >= 1');
      if (rowIndex > tableData.length) {
        return new FormulaError('#REF!', 'HLOOKUP row_index exceeds table rows');
      }
      let rangeLookup = true;
      const rlArg = args[3];
      if (rlArg !== undefined) {
        const rawRL = evaluator.evaluate(rlArg, context);
        if (rawRL instanceof FormulaError) return rawRL;
        rangeLookup = !!rawRL;
      }
      const row = Math.trunc(rowIndex) - 1;
      const firstRow = tableData[0] || [];
      const lookupLower = typeof lookupValue === 'string' ? lookupValue.toLowerCase() : null;
      const match = lookupLower === null ? undefined : wildcard(lookupLower);

      if (rangeLookup) {
        let bestCol = -1;
        for (let c = 0; c < firstRow.length; c++) {
          const cellVal = firstRow[c];
          if (cellVal === null || cellVal === undefined) continue;
          if (typeof lookupValue === 'number' && typeof cellVal === 'number') {
            if (cellVal <= lookupValue) bestCol = c;
            else break;
          } else if (lookupLower !== null && typeof cellVal === 'string') {
            if (cellVal.toLowerCase() <= lookupLower) bestCol = c;
            else break;
          }
        }
        if (bestCol === -1) return new FormulaError('#N/A', 'HLOOKUP no match found');
        return tableData[row]?.[bestCol] ?? null;
      } else {
        for (let c = 0; c < firstRow.length; c++) {
          const cellVal = firstRow[c];
          if (lookupLower !== null && typeof cellVal === 'string') {
            if ((match?.(cellVal, false, context.consumeWork) ?? -1) >= 0) return tableData[row]?.[c] ?? null;
          } else if (cellVal === lookupValue) {
            return tableData[row]?.[c] ?? null;
          }
        }
        return new FormulaError('#N/A', 'HLOOKUP no exact match found');
      }
    },
  });

  registry.set('XLOOKUP', {
    minArgs: 3,
    maxArgs: 6,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const lookupArg = args[0];
      if (lookupArg === undefined) {
        return new FormulaError('#VALUE!', 'XLOOKUP requires lookup_value, lookup_array, and return_array');
      }
      const lookupValue = evaluator.evaluate(lookupArg, context);
      if (lookupValue instanceof FormulaError) return lookupValue;
      // lookup_array
      const lookupArrayArg = args[1];
      if (lookupArrayArg === undefined || lookupArrayArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'XLOOKUP lookup_array must be a range');
      }
      const lookupArray = context.getRangeValues({ start: lookupArrayArg.start, end: lookupArrayArg.end });
      // return_array
      const returnArrayArg = args[2];
      if (returnArrayArg === undefined || returnArrayArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'XLOOKUP return_array must be a range');
      }
      const returnArray = context.getRangeValues({ start: returnArrayArg.start, end: returnArrayArg.end });
      // if_not_found (optional)
      let ifNotFound: unknown = new FormulaError('#N/A', 'XLOOKUP no match found');
      const infArg = args[3];
      if (infArg !== undefined) {
        ifNotFound = evaluator.evaluate(infArg, context);
      }
      // match_mode: 0=exact, -1=exact or next smaller, 1=exact or next larger
      let matchMode = 0;
      const mmArg = args[4];
      if (mmArg !== undefined) {
        const rawMM = evaluator.evaluate(mmArg, context);
        if (rawMM instanceof FormulaError) return rawMM;
        const mm = toNumber(rawMM);
        if (mm instanceof FormulaError) return mm;
        matchMode = Math.trunc(mm);
      }
      // search_mode: 1=first-to-last, -1=last-to-first
      let searchMode = 1;
      const smArg = args[5];
      if (smArg !== undefined) {
        const rawSM = evaluator.evaluate(smArg, context);
        if (rawSM instanceof FormulaError) return rawSM;
        const sm = toNumber(rawSM);
        if (sm instanceof FormulaError) return sm;
        searchMode = Math.trunc(sm);
      }
      // Flatten lookup array to 1D
      const isRow = lookupArray.length === 1;
      const len = isRow ? (lookupArray[0]?.length ?? 0) : lookupArray.length;
      const getVal = isRow ? (i: number) => lookupArray[0]?.[i] : (i: number) => lookupArray[i]?.[0];
      const lookupLower = typeof lookupValue === 'string' ? lookupValue.toLowerCase() : null;
      const match = lookupLower === null ? undefined : wildcard(lookupLower);

      const eq = (a: unknown, b: unknown): boolean => {
        if (lookupLower !== null && typeof a === 'string') return matchMode === 2 ? (match?.(a, false, context.consumeWork) ?? -1) >= 0 : a.toLowerCase() === lookupLower;
        return a === b;
      };

      let foundIdx = -1;
      if (matchMode === 0 || matchMode === 2) {
        // Exact match
        const start = searchMode >= 0 ? 0 : len - 1;
        const end = searchMode >= 0 ? len : -1;
        const step = searchMode >= 0 ? 1 : -1;
        for (let i = start; i !== end; i += step) {
          if (eq(getVal(i), lookupValue)) { foundIdx = i; break; }
        }
      } else if (matchMode === -1) {
        // Exact or next smaller
        let best = -1;
        for (let i = 0; i < len; i++) {
          const v = getVal(i);
          if (eq(v, lookupValue)) { foundIdx = i; break; }
          if (typeof lookupValue === typeof v && compareValues(v, lookupValue) < 0) {
            if (best === -1 || compareValues(v, getVal(best)) > 0) best = i;
          }
        }
        if (foundIdx === -1) foundIdx = best;
      } else if (matchMode === 1) {
        // Exact or next larger
        let best = -1;
        for (let i = 0; i < len; i++) {
          const v = getVal(i);
          if (eq(v, lookupValue)) { foundIdx = i; break; }
          if (typeof lookupValue === typeof v && compareValues(v, lookupValue) > 0) {
            if (best === -1 || compareValues(v, getVal(best)) < 0) best = i;
          }
        }
        if (foundIdx === -1) foundIdx = best;
      }

      if (foundIdx === -1) return ifNotFound;
      // Return from return_array at same position
      const isReturnRow = returnArray.length === 1;
      if (isReturnRow) return returnArray[0]?.[foundIdx] ?? null;
      return returnArray[foundIdx]?.[0] ?? null;
    },
  });

  registry.set('MATCH', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // Arg 0: lookup value
      const lookupArg = args[0];
      if (lookupArg === undefined) {
        return new FormulaError('#VALUE!', 'MATCH requires lookup_value and lookup_array');
      }
      const lookupValue = evaluator.evaluate(lookupArg, context);
      if (lookupValue instanceof FormulaError) return lookupValue;

      // Arg 1: lookup range (must be a RangeNode, should be 1D)
      const rangeArg = args[1];
      if (rangeArg === undefined || rangeArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'MATCH lookup_array must be a range');
      }
      const rangeData = context.getRangeValues({ start: rangeArg.start, end: rangeArg.end });

      // Flatten to a 1D array (take first column if multi-column, or first row if single-row)
      // For column ranges, access rangeData[i][0] directly to avoid intermediate array allocation
      const isSingleRow = rangeData.length === 1;
      const values = isSingleRow ? (rangeData[0] ?? []) : rangeData;
      const getValue = isSingleRow
        ? (i: number) => (values as unknown[])[i]
        : (i: number) => (values as unknown[][])[i]?.[0];
      const valuesLength = isSingleRow ? (values as unknown[]).length : (values as unknown[][]).length;

      // Arg 2: match_type (default 1)
      let matchType = 1;
      const mtArg = args[2];
      if (mtArg !== undefined) {
        const rawMT = evaluator.evaluate(mtArg, context);
        if (rawMT instanceof FormulaError) return rawMT;
        const mt = toNumber(rawMT);
        if (mt instanceof FormulaError) return mt;
        matchType = mt;
      }

      // Pre-lowercase the lookup value once (avoid per-iteration allocation)
      const lookupLower = typeof lookupValue === 'string' ? lookupValue.toLowerCase() : null;
      const match = lookupLower === null ? undefined : wildcard(lookupLower);

      if (matchType === 0) {
        // Exact match
        for (let i = 0; i < valuesLength; i++) {
          const cellVal = getValue(i);
          if (lookupLower !== null && typeof cellVal === 'string') {
            if ((match?.(cellVal, false, context.consumeWork) ?? -1) >= 0) return i + 1;
          } else if (cellVal === lookupValue) {
            return i + 1;
          }
        }
        return new FormulaError('#N/A', 'MATCH no exact match found');
      } else if (matchType === 1) {
        // Less than: data assumed sorted ascending, find largest value <= lookupValue
        let bestIndex = -1;
        for (let i = 0; i < valuesLength; i++) {
          const cellVal = getValue(i);
          if (cellVal === null || cellVal === undefined) continue;
          if (typeof lookupValue === 'number' && typeof cellVal === 'number') {
            if (cellVal <= lookupValue) bestIndex = i;
            else break;
          } else if (lookupLower !== null && typeof cellVal === 'string') {
            if (cellVal.toLowerCase() <= lookupLower) bestIndex = i;
            else break;
          }
        }
        if (bestIndex === -1) return new FormulaError('#N/A', 'MATCH no match found');
        return bestIndex + 1;
      } else {
        // matchType === -1: Greater than: data assumed sorted descending, find smallest value >= lookupValue
        let bestIndex = -1;
        for (let i = 0; i < valuesLength; i++) {
          const cellVal = getValue(i);
          if (cellVal === null || cellVal === undefined) continue;
          if (typeof lookupValue === 'number' && typeof cellVal === 'number') {
            if (cellVal >= lookupValue) bestIndex = i;
            else break;
          } else if (lookupLower !== null && typeof cellVal === 'string') {
            if (cellVal.toLowerCase() >= lookupLower) bestIndex = i;
            else break;
          }
        }
        if (bestIndex === -1) return new FormulaError('#N/A', 'MATCH no match found');
        return bestIndex + 1;
      }
    },
  });
}
