import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { FormulaError } from '../types';
import { toNumber } from '../evaluator';

interface ParsedCriteria {
  op: '=' | '<>' | '>' | '<' | '>=' | '<=';
  value: unknown;
  /** Pre-lowercased value for string comparisons (avoids per-cell allocation). */
  valueLower: string | null;
}

function makeCriteria(op: ParsedCriteria['op'], value: unknown): ParsedCriteria {
  return { op, value, valueLower: typeof value === 'string' ? value.toLowerCase() : null };
}

function parseCriteria(criteria: unknown): ParsedCriteria {
  if (typeof criteria === 'number') {
    return makeCriteria('=', criteria);
  }

  if (typeof criteria !== 'string') {
    return makeCriteria('=', criteria);
  }

  const str = criteria.trim();

  // Check for comparison operators (order matters: >= and <= before > and <)
  if (str.startsWith('>=')) {
    return makeCriteria('>=', parseNumericOrString(str.substring(2).trim()));
  }
  if (str.startsWith('<=')) {
    return makeCriteria('<=', parseNumericOrString(str.substring(2).trim()));
  }
  if (str.startsWith('<>')) {
    return makeCriteria('<>', parseNumericOrString(str.substring(2).trim()));
  }
  if (str.startsWith('>')) {
    return makeCriteria('>', parseNumericOrString(str.substring(1).trim()));
  }
  if (str.startsWith('<')) {
    return makeCriteria('<', parseNumericOrString(str.substring(1).trim()));
  }
  if (str.startsWith('=')) {
    return makeCriteria('=', parseNumericOrString(str.substring(1).trim()));
  }

  // No operator: exact match
  return makeCriteria('=', parseNumericOrString(str));
}

function parseNumericOrString(s: string): number | string {
  const n = Number(s);
  if (!Number.isNaN(n) && s !== '') return n;
  return s;
}

function matchesCriteria(cellValue: unknown, criteria: ParsedCriteria): boolean {
  const { op, value } = criteria;

  // Convert cell value to number if the criteria value is numeric
  let comparableCell: unknown = cellValue;
  if (typeof value === 'number' && typeof cellValue !== 'number') {
    const n = toNumber(cellValue);
    if (n instanceof FormulaError) return false;
    comparableCell = n;
  }

  // For string comparisons, case-insensitive (use pre-lowercased criteria value)
  if (typeof comparableCell === 'string' && criteria.valueLower !== null) {
    const a = comparableCell.toLowerCase();
    const b = criteria.valueLower;
    switch (op) {
      case '=': return a === b;
      case '<>': return a !== b;
      case '>': return a > b;
      case '<': return a < b;
      case '>=': return a >= b;
      case '<=': return a <= b;
    }
  }

  // Numeric or mixed comparisons
  if (typeof comparableCell === 'number' && typeof value === 'number') {
    switch (op) {
      case '=': return comparableCell === value;
      case '<>': return comparableCell !== value;
      case '>': return comparableCell > value;
      case '<': return comparableCell < value;
      case '>=': return comparableCell >= value;
      case '<=': return comparableCell <= value;
    }
  }

  // Fallback: equality check
  if (op === '=') return comparableCell === value;
  if (op === '<>') return comparableCell !== value;

  return false;
}

export function registerStatsFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('SUMIF', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // Arg 0: criteria range (must be a RangeNode)
      const rangeArg = args[0];
      if (rangeArg === undefined || rangeArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'SUMIF range must be a cell range');
      }
      const criteriaRange = context.getRangeValues({ start: rangeArg.start, end: rangeArg.end });

      // Arg 1: criteria
      const criteriaArg = args[1];
      if (criteriaArg === undefined) {
        return new FormulaError('#VALUE!', 'SUMIF requires a criteria argument');
      }
      const rawCriteria = evaluator.evaluate(criteriaArg, context);
      if (rawCriteria instanceof FormulaError) return rawCriteria;
      const criteria = parseCriteria(rawCriteria);

      // Arg 2: sum range (optional, defaults to criteria range)
      let sumRange: unknown[][];
      const sumRangeArg = args[2];
      if (sumRangeArg !== undefined) {
        if (sumRangeArg.kind !== 'range') {
          return new FormulaError('#VALUE!', 'SUMIF sum_range must be a cell range');
        }
        sumRange = context.getRangeValues({ start: sumRangeArg.start, end: sumRangeArg.end });
      } else {
        sumRange = criteriaRange;
      }

      let sum = 0;
      for (let r = 0; r < criteriaRange.length; r++) {
        const critRow = criteriaRange[r];
        if (critRow === undefined) continue;
        const sumRow = sumRange[r];
        for (let c = 0; c < critRow.length; c++) {
          if (matchesCriteria(critRow[c], criteria)) {
            const rawSumVal = sumRow === undefined ? undefined : sumRow[c];
            const sumVal = rawSumVal !== undefined ? rawSumVal : null;
            const n = toNumber(sumVal);
            if (typeof n === 'number') {
              sum += n;
            }
            // If toNumber returns an error, skip (non-numeric in sum range)
          }
        }
      }
      return sum;
    },
  });

  registry.set('COUNTIF', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // Arg 0: range (must be a RangeNode)
      const rangeArg = args[0];
      if (rangeArg === undefined || rangeArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'COUNTIF range must be a cell range');
      }
      const rangeData = context.getRangeValues({ start: rangeArg.start, end: rangeArg.end });

      // Arg 1: criteria
      const criteriaArg = args[1];
      if (criteriaArg === undefined) {
        return new FormulaError('#VALUE!', 'COUNTIF requires a criteria argument');
      }
      const rawCriteria = evaluator.evaluate(criteriaArg, context);
      if (rawCriteria instanceof FormulaError) return rawCriteria;
      const criteria = parseCriteria(rawCriteria);

      let count = 0;
      for (let r = 0; r < rangeData.length; r++) {
        const row = rangeData[r];
        if (row === undefined) continue;
        for (let c = 0; c < row.length; c++) {
          if (matchesCriteria(row[c], criteria)) {
            count++;
          }
        }
      }
      return count;
    },
  });

  registry.set('AVERAGEIF', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // Arg 0: criteria range (must be a RangeNode)
      const rangeArg = args[0];
      if (rangeArg === undefined || rangeArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'AVERAGEIF range must be a cell range');
      }
      const criteriaRange = context.getRangeValues({ start: rangeArg.start, end: rangeArg.end });

      // Arg 1: criteria
      const criteriaArg = args[1];
      if (criteriaArg === undefined) {
        return new FormulaError('#VALUE!', 'AVERAGEIF requires a criteria argument');
      }
      const rawCriteria = evaluator.evaluate(criteriaArg, context);
      if (rawCriteria instanceof FormulaError) return rawCriteria;
      const criteria = parseCriteria(rawCriteria);

      // Arg 2: average range (optional, defaults to criteria range)
      let avgRange: unknown[][];
      const avgRangeArg = args[2];
      if (avgRangeArg !== undefined) {
        if (avgRangeArg.kind !== 'range') {
          return new FormulaError('#VALUE!', 'AVERAGEIF avg_range must be a cell range');
        }
        avgRange = context.getRangeValues({ start: avgRangeArg.start, end: avgRangeArg.end });
      } else {
        avgRange = criteriaRange;
      }

      let sum = 0;
      let count = 0;
      for (let r = 0; r < criteriaRange.length; r++) {
        const critRow = criteriaRange[r];
        if (critRow === undefined) continue;
        const avgRow = avgRange[r];
        for (let c = 0; c < critRow.length; c++) {
          if (matchesCriteria(critRow[c], criteria)) {
            const rawAvgVal = avgRow === undefined ? undefined : avgRow[c];
            const avgVal = rawAvgVal !== undefined ? rawAvgVal : null;
            const n = toNumber(avgVal);
            if (typeof n === 'number') {
              sum += n;
              count++;
            }
          }
        }
      }

      if (count === 0) return new FormulaError('#DIV/0!', 'No matching values for AVERAGEIF');
      return sum / count;
    },
  });

  registry.set('SUMIFS', {
    minArgs: 3,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // SUMIFS(sum_range, criteria_range1, criteria1, criteria_range2, criteria2, ...)
      if ((args.length - 1) % 2 !== 0) {
        return new FormulaError('#VALUE!', 'SUMIFS requires sum_range + pairs of criteria_range, criteria');
      }
      const sumRangeArg = args[0];
      if (sumRangeArg === undefined || sumRangeArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'SUMIFS sum_range must be a cell range');
      }
      const sumRange = context.getRangeValues({ start: sumRangeArg.start, end: sumRangeArg.end });

      const pairs: { range: unknown[][]; criteria: ParsedCriteria }[] = [];
      for (let i = 1; i < args.length; i += 2) {
        const rangeArg = args[i];
        if (rangeArg === undefined || rangeArg.kind !== 'range') {
          return new FormulaError('#VALUE!', 'SUMIFS criteria_range must be a cell range');
        }
        const criteriaArg = args[i + 1];
        if (criteriaArg === undefined) {
          return new FormulaError('#VALUE!', 'SUMIFS requires sum_range + pairs of criteria_range, criteria');
        }
        const range = context.getRangeValues({ start: rangeArg.start, end: rangeArg.end });
        const rawCriteria = evaluator.evaluate(criteriaArg, context);
        if (rawCriteria instanceof FormulaError) return rawCriteria;
        pairs.push({ range, criteria: parseCriteria(rawCriteria) });
      }

      let sum = 0;
      for (let r = 0; r < sumRange.length; r++) {
        const sumRow = sumRange[r];
        if (sumRow === undefined) continue;
        for (let c = 0; c < sumRow.length; c++) {
          let allMatch = true;
          for (const pair of pairs) {
            const cellVal = pair.range[r]?.[c];
            if (!matchesCriteria(cellVal, pair.criteria)) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) {
            const n = toNumber(sumRow[c]);
            if (typeof n === 'number') sum += n;
          }
        }
      }
      return sum;
    },
  });

  registry.set('COUNTIFS', {
    minArgs: 2,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // COUNTIFS(criteria_range1, criteria1, criteria_range2, criteria2, ...)
      if (args.length % 2 !== 0) {
        return new FormulaError('#VALUE!', 'COUNTIFS requires pairs of criteria_range, criteria');
      }

      const pairs: { range: unknown[][]; criteria: ParsedCriteria }[] = [];
      for (let i = 0; i < args.length; i += 2) {
        const rangeArg = args[i];
        if (rangeArg === undefined || rangeArg.kind !== 'range') {
          return new FormulaError('#VALUE!', 'COUNTIFS criteria_range must be a cell range');
        }
        const criteriaArg = args[i + 1];
        if (criteriaArg === undefined) {
          return new FormulaError('#VALUE!', 'COUNTIFS requires pairs of criteria_range, criteria');
        }
        const range = context.getRangeValues({ start: rangeArg.start, end: rangeArg.end });
        const rawCriteria = evaluator.evaluate(criteriaArg, context);
        if (rawCriteria instanceof FormulaError) return rawCriteria;
        pairs.push({ range, criteria: parseCriteria(rawCriteria) });
      }

      // Use first range dimensions
      const firstPair = pairs[0];
      if (firstPair === undefined) {
        return new FormulaError('#VALUE!', 'COUNTIFS requires pairs of criteria_range, criteria');
      }
      const firstRange = firstPair.range;
      let count = 0;
      for (let r = 0; r < firstRange.length; r++) {
        const firstRow = firstRange[r];
        if (firstRow === undefined) continue;
        for (let c = 0; c < firstRow.length; c++) {
          let allMatch = true;
          for (const pair of pairs) {
            const cellVal = pair.range[r]?.[c];
            if (!matchesCriteria(cellVal, pair.criteria)) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) count++;
        }
      }
      return count;
    },
  });

  registry.set('AVERAGEIFS', {
    minArgs: 3,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // AVERAGEIFS(avg_range, criteria_range1, criteria1, criteria_range2, criteria2, ...)
      if ((args.length - 1) % 2 !== 0) {
        return new FormulaError('#VALUE!', 'AVERAGEIFS requires avg_range + pairs of criteria_range, criteria');
      }
      const avgRangeArg = args[0];
      if (avgRangeArg === undefined || avgRangeArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'AVERAGEIFS avg_range must be a cell range');
      }
      const avgRange = context.getRangeValues({ start: avgRangeArg.start, end: avgRangeArg.end });

      const pairs: { range: unknown[][]; criteria: ParsedCriteria }[] = [];
      for (let i = 1; i < args.length; i += 2) {
        const rangeArg = args[i];
        if (rangeArg === undefined || rangeArg.kind !== 'range') {
          return new FormulaError('#VALUE!', 'AVERAGEIFS criteria_range must be a cell range');
        }
        const criteriaArg = args[i + 1];
        if (criteriaArg === undefined) {
          return new FormulaError('#VALUE!', 'AVERAGEIFS requires avg_range + pairs of criteria_range, criteria');
        }
        const range = context.getRangeValues({ start: rangeArg.start, end: rangeArg.end });
        const rawCriteria = evaluator.evaluate(criteriaArg, context);
        if (rawCriteria instanceof FormulaError) return rawCriteria;
        pairs.push({ range, criteria: parseCriteria(rawCriteria) });
      }

      let sum = 0;
      let count = 0;
      for (let r = 0; r < avgRange.length; r++) {
        const avgRow = avgRange[r];
        if (avgRow === undefined) continue;
        for (let c = 0; c < avgRow.length; c++) {
          let allMatch = true;
          for (const pair of pairs) {
            const cellVal = pair.range[r]?.[c];
            if (!matchesCriteria(cellVal, pair.criteria)) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) {
            const n = toNumber(avgRow[c]);
            if (typeof n === 'number') {
              sum += n;
              count++;
            }
          }
        }
      }

      if (count === 0) return new FormulaError('#DIV/0!', 'No matching values for AVERAGEIFS');
      return sum / count;
    },
  });
}
