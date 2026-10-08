/**
 * Condition filters (Excel's number/text/date filters and custom AutoFilter):
 * operator metadata for filter UIs and the predicate used by client-side
 * filtering. The matching itself lives in workers/sortFilterPrimitives so the
 * main thread and the Web Worker evaluate conditions identically.
 */
import type {
  ConditionFilterKind,
  ConditionOperator,
  IColumnDef,
  IConditionFilterValue,
  IFilterCondition,
} from '../types';
import { prepareCondition, prepareConditionFilter, matchConditionFilter, conditionFilterNeedsColumnValues } from '../workers/sortFilterPrimitives';

/** Operators offered for each condition filter kind, in menu order. */
export const CONDITION_OPERATORS: Readonly<Record<ConditionFilterKind, readonly ConditionOperator[]>> = {
  number: [
    'equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual',
    'between', 'top', 'bottom', 'aboveAverage', 'belowAverage', 'blank', 'notBlank',
  ],
  text: ['contains', 'notContains', 'equals', 'notEquals', 'beginsWith', 'endsWith', 'blank', 'notBlank'],
  date: [
    'equals', 'notEquals', 'lessThan', 'lessThanOrEqual', 'greaterThan', 'greaterThanOrEqual',
    'between', 'blank', 'notBlank',
  ],
};

const LABELS: Record<ConditionOperator, string> = {
  equals: 'Equals',
  notEquals: 'Does not equal',
  contains: 'Contains',
  notContains: 'Does not contain',
  beginsWith: 'Begins with',
  endsWith: 'Ends with',
  greaterThan: 'Greater than',
  greaterThanOrEqual: 'Greater than or equal to',
  lessThan: 'Less than',
  lessThanOrEqual: 'Less than or equal to',
  between: 'Between',
  top: 'Top N',
  bottom: 'Bottom N',
  aboveAverage: 'Above average',
  belowAverage: 'Below average',
  blank: 'Is blank',
  notBlank: 'Is not blank',
};

const DATE_LABELS: Partial<Record<ConditionOperator, string>> = {
  equals: 'Is on',
  notEquals: 'Is not on',
  lessThan: 'Is before',
  lessThanOrEqual: 'Is on or before',
  greaterThan: 'Is after',
  greaterThanOrEqual: 'Is on or after',
};

/** Display label for an operator ("Greater than", "Is before", ...). */
export function getConditionOperatorLabel(operator: ConditionOperator, kind: ConditionFilterKind = 'number'): string {
  return (kind === 'date' ? DATE_LABELS[operator] : undefined) ?? LABELS[operator] ?? operator;
}

/** Number of operands an operator takes: 0 (blank, average), 1, or 2 (between). */
export function getConditionOperatorArity(operator: ConditionOperator): 0 | 1 | 2 {
  if (operator === 'blank' || operator === 'notBlank' || operator === 'aboveAverage' || operator === 'belowAverage') return 0;
  return operator === 'between' ? 2 : 1;
}

/**
 * Condition filter kind for a column: `filterable.type: 'number'` is always
 * numeric; `'condition'` follows the column `type` (numeric, date, else text).
 * Returns undefined for columns without a condition filter.
 */
export function resolveConditionFilterKind<T>(col: Pick<IColumnDef<T>, 'type' | 'filterable'>): ConditionFilterKind | undefined {
  const type = col.filterable?.type;
  if (type === 'number') return 'number';
  if (type !== 'condition') return undefined;
  if (col.type === 'numeric') return 'number';
  if (col.type === 'date') return 'date';
  return 'text';
}

/** True when the condition has an operator and every operand it needs. */
export function isConditionComplete(kind: ConditionFilterKind, condition: IFilterCondition): boolean {
  // Stats operators prepare without column values; only completeness matters here.
  return prepareCondition(kind, condition, []) !== null;
}

/**
 * Drop incomplete conditions. Returns undefined when none are left, so an
 * emptied condition filter clears instead of filtering out every row.
 */
export function normalizeConditionFilter(value: IConditionFilterValue | undefined): IConditionFilterValue | undefined {
  if (!value || !Array.isArray(value.conditions)) return undefined;
  const conditions = value.conditions.filter((c) => c && isConditionComplete(value.kind, c));
  if (conditions.length === 0) return undefined;
  return conditions.length > 1
    ? { kind: value.kind, conditions, join: value.join === 'or' ? 'or' : 'and' }
    : { kind: value.kind, conditions };
}

/**
 * Build a row-value predicate for a condition filter. `columnValues` (every
 * value in the column) is read only for top/bottom N and above/below average,
 * which compare against the whole column. Returns null when the filter has no
 * complete condition.
 */
export function createConditionPredicate(
  value: IConditionFilterValue,
  columnValues?: () => unknown[],
): ((cellValue: unknown) => boolean) | null {
  const values = conditionFilterNeedsColumnValues(value) ? (columnValues?.() ?? []) : null;
  const prepared = prepareConditionFilter(value, values);
  if (!prepared) return null;
  return (cellValue) => matchConditionFilter(prepared, cellValue);
}
