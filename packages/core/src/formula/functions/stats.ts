import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { FormulaError } from '../types';
import { wildcard } from '../wildcard';
import { toNumber, compareValues } from '../evaluator';

interface ParsedCriteria {
  op: '=' | '<>' | '>' | '<' | '>=' | '<=';
  value: unknown;
  match?: ReturnType<typeof wildcard>;
}

function parseCriteria(criteria: unknown): ParsedCriteria {
  let op: ParsedCriteria['op'] = '=';
  let value = criteria;
  if (typeof criteria === 'string') {
    const match = /^(>=|<=|<>|>|<|=)?(.*)$/s.exec(criteria);
    op = (match?.[1] ?? '=') as ParsedCriteria['op'];
    const text = match?.[2] ?? '';
    if (/^(TRUE|FALSE)$/i.test(text)) value = text.toUpperCase() === 'TRUE';
    else {
      const number = text === '' ? new FormulaError('#VALUE!') : toNumber(text);
      value = typeof number === 'number' ? number : text;
    }
  }
  return { op, value, match: typeof value === 'string' && value !== '' && (op === '=' || op === '<>') ? wildcard(value) : undefined };
}

function matchesCriteria(cellValue: unknown, criteria: ParsedCriteria, context: IFormulaContext): boolean {
  context.consumeWork?.(1);
  const { op, value } = criteria;
  if (cellValue instanceof FormulaError) return false;
  if (cellValue instanceof Date) cellValue = toNumber(cellValue);
  const blank = cellValue === null || cellValue === undefined || cellValue === '';
  if (value === '') return op === '=' ? blank : op === '<>' ? !blank : false;
  if (blank) return false;
  if (typeof value === 'number' && typeof cellValue !== 'number') return false;
  if (typeof value === 'boolean' && typeof cellValue !== 'boolean') return false;
  if (criteria.match) {
    const match = typeof cellValue === 'string' && criteria.match(cellValue, false, context.consumeWork) >= 0;
    return op === '=' ? match : !match;
  }
  if (typeof cellValue !== typeof value) return op === '<>';
  const cmp = compareValues(cellValue, value);
  switch (op) {
    case '=': return cmp === 0;
    case '<>': return cmp !== 0;
    case '>': return cmp > 0;
    case '<': return cmp < 0;
    case '>=': return cmp >= 0;
    case '<=': return cmp <= 0;
  }
}

function sameShape(a: ASTNode, b: ASTNode): boolean {
  if (a.kind !== 'range' || b.kind !== 'range') return false;
  return Math.abs(a.end.row - a.start.row) === Math.abs(b.end.row - b.start.row) && Math.abs(a.end.col - a.start.col) === Math.abs(b.end.col - b.start.col);
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
          if (matchesCriteria(critRow[c], criteria, context)) {
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
          if (matchesCriteria(row[c], criteria, context)) {
            count++;
          }
        }
      }
      if (matchesCriteria(undefined, criteria, context)) {
        const total = (Math.abs(rangeArg.end.row - rangeArg.start.row) + 1) * (Math.abs(rangeArg.end.col - rangeArg.start.col) + 1);
        count += total - rangeData.reduce((size, row) => size + row.length, 0);
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
          if (matchesCriteria(critRow[c], criteria, context)) {
            const rawAvgVal = avgRow === undefined ? undefined : avgRow[c];
            const avgVal = rawAvgVal !== undefined ? rawAvgVal : null;
            const n = avgVal;
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
        if (!sumRangeArg || !sameShape(sumRangeArg, rangeArg)) return new FormulaError('#VALUE!', 'SUMIFS range dimensions must match');
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
            if (!matchesCriteria(cellVal, pair.criteria, context)) {
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
        if (!args[0] || !sameShape(args[0], rangeArg)) return new FormulaError('#VALUE!', 'COUNTIFS range dimensions must match');
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
      const rows = Math.max(...pairs.map(pair => pair.range.length));
      const cols = Math.max(...pairs.map(pair => pair.range[0]?.length ?? 0));
      let count = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let allMatch = true;
          for (const pair of pairs) {
            const cellVal = pair.range[r]?.[c];
            if (!matchesCriteria(cellVal, pair.criteria, context)) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) count++;
        }
      }
      const firstArg = args[0];
      if (firstArg?.kind === 'range' && pairs.every(pair => matchesCriteria(undefined, pair.criteria, context))) {
        const total = (Math.abs(firstArg.end.row - firstArg.start.row) + 1) * (Math.abs(firstArg.end.col - firstArg.start.col) + 1);
        count += total - rows * cols;
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
        if (!avgRangeArg || !sameShape(avgRangeArg, rangeArg)) return new FormulaError('#VALUE!', 'AVERAGEIFS range dimensions must match');
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
            if (!matchesCriteria(cellVal, pair.criteria, context)) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) {
            const n = avgRow[c];
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
