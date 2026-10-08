import { processClientSideData } from '../clientSideData';
import { computeNextSortModel, normalizeSortModel } from '../sortHelpers';
import {
  CONDITION_OPERATORS,
  getConditionOperatorArity,
  getConditionOperatorLabel,
  normalizeConditionFilter,
  resolveConditionFilterKind,
} from '../conditionFilter';
import { mergeFilter } from '../ogridHelpers';
import { shouldUseWorkerSort } from '../workerSortMode';
import { getHeaderFilterConfig } from '../dataGridViewModel';
import type { ConditionOperator, IColumnDef, IConditionFilterValue, IFilterCondition, IFilters, ISortModelItem } from '../../types';

// ---------------------------------------------------------------------------
// Sort model state transitions
// ---------------------------------------------------------------------------

describe('computeNextSortModel', () => {
  const two: ISortModelItem[] = [{ field: 'a', direction: 'asc' }, { field: 'b', direction: 'desc' }];

  it('plain toggle resets to a single level (new column ascending, primary flips)', () => {
    expect(computeNextSortModel(two, 'c')).toEqual([{ field: 'c', direction: 'asc' }]);
    expect(computeNextSortModel(two, 'a')).toEqual([{ field: 'a', direction: 'desc' }]);
    // A secondary column clicked plainly becomes the only (ascending) level.
    expect(computeNextSortModel(two, 'b')).toEqual([{ field: 'b', direction: 'asc' }]);
    expect(computeNextSortModel([], 'a')).toEqual([{ field: 'a', direction: 'asc' }]);
  });

  it('additive toggle appends, then cycles asc -> desc -> removed', () => {
    const added = computeNextSortModel([{ field: 'a', direction: 'asc' }], 'b', undefined, { additive: true });
    expect(added).toEqual([{ field: 'a', direction: 'asc' }, { field: 'b', direction: 'asc' }]);
    const flipped = computeNextSortModel(added, 'b', undefined, { additive: true });
    expect(flipped).toEqual([{ field: 'a', direction: 'asc' }, { field: 'b', direction: 'desc' }]);
    expect(computeNextSortModel(flipped, 'b', undefined, { additive: true })).toEqual([{ field: 'a', direction: 'asc' }]);
    // Cycling the primary keeps its position.
    expect(computeNextSortModel(flipped, 'a', undefined, { additive: true })).toEqual([
      { field: 'a', direction: 'desc' },
      { field: 'b', direction: 'desc' },
    ]);
  });

  it('explicit directions: plain replaces, additive updates in place or appends', () => {
    expect(computeNextSortModel(two, 'b', 'asc')).toEqual([{ field: 'b', direction: 'asc' }]);
    expect(computeNextSortModel(two, 'b', 'asc', { additive: true })).toEqual([
      { field: 'a', direction: 'asc' },
      { field: 'b', direction: 'asc' },
    ]);
    expect(computeNextSortModel(two, 'c', 'desc', { additive: true })).toEqual([...two, { field: 'c', direction: 'desc' }]);
  });

  it('null clears a single-level sort and removes one level of a multi-level sort', () => {
    expect(computeNextSortModel([{ field: 'a', direction: 'asc' }], 'a', null)).toEqual([]);
    // Same as computeNextSortState: clearing from any column's menu clears a single sort.
    expect(computeNextSortModel([{ field: 'a', direction: 'asc' }], 'z', null)).toEqual([]);
    expect(computeNextSortModel(two, 'a', null)).toEqual([{ field: 'b', direction: 'desc' }]);
  });

  it('normalizeSortModel drops empty fields and duplicate fields (first level wins)', () => {
    expect(normalizeSortModel('x', 'desc')).toEqual([{ field: 'x', direction: 'desc' }]);
    expect(normalizeSortModel('x')).toEqual([{ field: 'x', direction: 'asc' }]);
    expect(normalizeSortModel('')).toEqual([]);
    expect(normalizeSortModel(undefined)).toEqual([]);
    expect(
      normalizeSortModel([
        { field: '', direction: 'asc' },
        { field: 'a', direction: 'desc' },
        { field: 'a', direction: 'asc' },
      ]),
    ).toEqual([{ field: 'a', direction: 'desc' }]);
  });
});

// ---------------------------------------------------------------------------
// Multi-level client-side sort
// ---------------------------------------------------------------------------

type Person = { id: number; dept: string | null; age: number | null; joined: string | null; level: string };

const people: Person[] = [
  { id: 1, dept: 'Sales', age: 30, joined: '2021-05-01', level: 'Mid' },
  { id: 2, dept: 'eng', age: 25, joined: '2020-01-01', level: 'Senior' },
  { id: 3, dept: 'Sales', age: 25, joined: null, level: 'Junior' },
  { id: 4, dept: 'Eng', age: 30, joined: '2019-03-15', level: 'Junior' },
  { id: 5, dept: null, age: 40, joined: '2018-07-07', level: 'Mid' },
  { id: 6, dept: 'Sales', age: 25, joined: '2022-02-02', level: 'Senior' },
];

const LEVEL_ORDER: Record<string, number> = { Junior: 0, Mid: 1, Senior: 2 };
const peopleColumns: IColumnDef<Person>[] = [
  { columnId: 'dept', name: 'Dept' },
  { columnId: 'age', name: 'Age', type: 'numeric' },
  { columnId: 'joined', name: 'Joined', type: 'date' },
  { columnId: 'level', name: 'Level', compare: (a, b) => (LEVEL_ORDER[a.level] ?? 0) - (LEVEL_ORDER[b.level] ?? 0) },
];

const ids = (rows: Person[]) => rows.map((r) => r.id);

describe('processClientSideData multi-level sort', () => {
  it('a single-level model sorts exactly like the field/direction arguments', () => {
    expect(ids(processClientSideData(people, peopleColumns, {}, [{ field: 'age', direction: 'desc' }]))).toEqual(
      ids(processClientSideData(people, peopleColumns, {}, 'age', 'desc')),
    );
  });

  it('breaks ties with later levels, case-insensitively, blanks first ascending', () => {
    const rows = processClientSideData(people, peopleColumns, {}, [
      { field: 'dept', direction: 'asc' },
      { field: 'age', direction: 'desc' },
    ]);
    // null dept first; eng/Eng tie on dept, age desc puts 4 (30) before 2 (25); Sales: 1 (30), then 3 and 6 (25) in data order.
    expect(ids(rows)).toEqual([5, 4, 2, 1, 3, 6]);
  });

  it('is stable: rows equal on every level keep their data order', () => {
    const rows = processClientSideData(people, peopleColumns, {}, [
      { field: 'age', direction: 'asc' },
      { field: 'dept', direction: 'desc' },
    ]);
    // age 25: Sales (3, 6 in data order), then eng (2); age 30: Sales (1), Eng (4); age 40: 5.
    expect(ids(rows)).toEqual([3, 6, 2, 1, 4, 5]);
  });

  it('mixes custom compare and date levels', () => {
    const rows = processClientSideData(people, peopleColumns, {}, [
      { field: 'level', direction: 'desc' },
      { field: 'joined', direction: 'asc' },
    ]);
    // Senior: 2 (2020), 6 (2022); Mid: 5 (2018), 1 (2021); Junior: 3 (null first), 4 (2019).
    expect(ids(rows)).toEqual([2, 6, 5, 1, 3, 4]);
  });

  it('ignores empty and duplicate levels and does not mutate the input', () => {
    const input = people.slice();
    const rows = processClientSideData(input, peopleColumns, {}, [
      { field: '', direction: 'asc' },
      { field: 'age', direction: 'asc' },
      { field: 'age', direction: 'desc' },
    ]);
    expect(ids(rows)).toEqual([2, 3, 6, 1, 4, 5]);
    expect(ids(input)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(processClientSideData(input, peopleColumns, {}, [])).toBe(input);
  });

  it('sorts a filtered result by several levels', () => {
    const filters: IFilters = { dept: { type: 'text', value: 'sales' } };
    const rows = processClientSideData(people, peopleColumns, filters, [
      { field: 'age', direction: 'asc' },
      { field: 'joined', direction: 'desc' },
    ]);
    expect(ids(rows)).toEqual([6, 3, 1]);
  });
});

// ---------------------------------------------------------------------------
// Condition filters
// ---------------------------------------------------------------------------

type Item = { id: number; v: unknown };
const numCol: IColumnDef<Item>[] = [{ columnId: 'v', name: 'V', type: 'numeric', filterable: { type: 'number' } }];
const numItems: Item[] = [
  { id: 1, v: 10 },
  { id: 2, v: '20' },
  { id: 3, v: null },
  { id: 4, v: '' },
  { id: 5, v: 5 },
  { id: 6, v: 'n/a' },
  { id: 7, v: '1,000' },
  { id: 8, v: 20 },
  { id: 9, v: Number.NaN },
];

function filterIds(items: Item[], columns: IColumnDef<Item>[], value: IConditionFilterValue): number[] {
  return processClientSideData(items, columns, { v: { type: 'condition', value } }).map((r) => r.id);
}
const num = (...conditions: IFilterCondition[]) => (join?: 'and' | 'or'): IConditionFilterValue => ({ kind: 'number', conditions, join });
const one = (operator: ConditionOperator, value?: string | number, valueTo?: string | number) => num({ operator, value, valueTo })();

describe('number condition filters', () => {
  it.each<[ConditionOperator, string | number | undefined, string | number | undefined, number[]]>([
    ['equals', 20, undefined, [2, 8]],
    ['equals', '20', undefined, [2, 8]],
    // Non-numeric and blank cells don't equal a number, so they pass "does not equal".
    ['notEquals', 20, undefined, [1, 3, 4, 5, 6, 7, 9]],
    ['greaterThan', 10, undefined, [2, 7, 8]],
    ['greaterThanOrEqual', 10, undefined, [1, 2, 7, 8]],
    ['lessThan', 10, undefined, [5]],
    ['lessThanOrEqual', 10, undefined, [1, 5]],
    ['between', 5, 20, [1, 2, 5, 8]],
    // Reversed bounds are swapped.
    ['between', 20, 5, [1, 2, 5, 8]],
    // Ties at the Nth value are included.
    ['top', 2, undefined, [7, 2, 8].sort((a, b) => a - b)],
    ['top', 1, undefined, [7]],
    ['bottom', 2, undefined, [1, 5]],
    ['top', 100, undefined, [1, 2, 5, 7, 8]],
    ['blank', undefined, undefined, [3, 4, 9]],
    ['notBlank', undefined, undefined, [1, 2, 5, 6, 7, 8]],
  ])('%s %p %p', (operator, value, valueTo, expected) => {
    expect(filterIds(numItems, numCol, one(operator, value, valueTo))).toEqual(expected);
  });

  it('above / below average use the numeric cells of the whole column', () => {
    // Numbers: 10, 20, 5, 1000, 20 -> average 211.
    expect(filterIds(numItems, numCol, one('aboveAverage'))).toEqual([7]);
    expect(filterIds(numItems, numCol, one('belowAverage'))).toEqual([1, 2, 5, 8]);
  });

  it('top N is computed over all rows, before other columns filter', () => {
    type Two = { id: number; v: number; g: string };
    const rows: Two[] = [
      { id: 1, v: 1, g: 'x' },
      { id: 2, v: 9, g: 'y' },
      { id: 3, v: 5, g: 'x' },
    ];
    const cols: IColumnDef<Two>[] = [
      { columnId: 'v', name: 'V', type: 'numeric' },
      { columnId: 'g', name: 'G' },
    ];
    const result = processClientSideData(rows, cols, {
      v: { type: 'condition', value: { kind: 'number', conditions: [{ operator: 'top', value: 1 }] } },
      g: { type: 'text', value: 'x' },
    });
    expect(result).toEqual([]);
  });

  it('joins two conditions with AND by default and OR on request', () => {
    const conds = num({ operator: 'greaterThan', value: 5 }, { operator: 'lessThan', value: 20 });
    expect(filterIds(numItems, numCol, conds())).toEqual([1]);
    expect(filterIds(numItems, numCol, conds('and'))).toEqual([1]);
    const either = num({ operator: 'lessThan', value: 6 }, { operator: 'greaterThan', value: 100 });
    expect(filterIds(numItems, numCol, either('or'))).toEqual([5, 7]);
  });

  it('ignores incomplete conditions, and a filter with none filters nothing', () => {
    expect(filterIds(numItems, numCol, num({ operator: 'greaterThan', value: 15 }, { operator: 'lessThan' })())).toEqual([2, 7, 8]);
    expect(filterIds(numItems, numCol, one('greaterThan', 'abc'))).toHaveLength(numItems.length);
    expect(filterIds(numItems, numCol, one('between', 1))).toHaveLength(numItems.length);
    expect(filterIds(numItems, numCol, one('top', 0))).toHaveLength(numItems.length);
  });
});

describe('text condition filters', () => {
  const textCol: IColumnDef<Item>[] = [{ columnId: 'v', name: 'V', filterable: { type: 'condition' } }];
  const items: Item[] = [
    { id: 1, v: 'Apple pie' },
    { id: 2, v: 'banana' },
    { id: 3, v: null },
    { id: 4, v: '   ' },
    { id: 5, v: 'PINEAPPLE' },
    { id: 6, v: 42 },
  ];
  const text = (operator: ConditionOperator, value?: string): IConditionFilterValue => ({ kind: 'text', conditions: [{ operator, value }] });

  it.each<[ConditionOperator, string | undefined, number[]]>([
    ['equals', 'BANANA', [2]],
    ['equals', '42', [6]],
    ['notEquals', 'banana', [1, 3, 4, 5, 6]],
    ['contains', 'apple', [1, 5]],
    ['notContains', 'apple', [2, 3, 4, 6]],
    ['beginsWith', 'app', [1]],
    ['beginsWith', 'pine', [5]],
    ['endsWith', 'APPLE', [5]],
    ['endsWith', 'pie', [1]],
    ['blank', undefined, [3, 4]],
    ['notBlank', undefined, [1, 2, 5, 6]],
  ])('%s %p', (operator, value, expected) => {
    expect(filterIds(items, textCol, text(operator, value))).toEqual(expected);
  });

  it('combines text conditions with OR', () => {
    const value: IConditionFilterValue = {
      kind: 'text',
      conditions: [{ operator: 'beginsWith', value: 'b' }, { operator: 'endsWith', value: 'pie' }],
      join: 'or',
    };
    expect(filterIds(items, textCol, value)).toEqual([1, 2]);
  });
});

describe('date condition filters', () => {
  const dateCol: IColumnDef<Item>[] = [{ columnId: 'v', name: 'V', type: 'date', filterable: { type: 'condition' } }];
  const items: Item[] = [
    { id: 1, v: '2024-01-15' },
    { id: 2, v: '2024-01-15T18:30:00Z' },
    { id: 3, v: new Date(Date.UTC(2024, 0, 16, 9)) },
    { id: 4, v: '2024-01-14' },
    { id: 5, v: null },
    { id: 6, v: 'not a date' },
    { id: 7, v: Date.UTC(2024, 1, 1) },
  ];
  const date = (operator: ConditionOperator, value?: string, valueTo?: string): IConditionFilterValue => ({
    kind: 'date',
    conditions: [{ operator, value, valueTo }],
  });

  it.each<[ConditionOperator, string | undefined, string | undefined, number[]]>([
    // A day matches every instant on it (UTC).
    ['equals', '2024-01-15', undefined, [1, 2]],
    ['notEquals', '2024-01-15', undefined, [3, 4, 5, 6, 7]],
    ['greaterThan', '2024-01-15', undefined, [3, 7]],
    ['greaterThanOrEqual', '2024-01-15', undefined, [1, 2, 3, 7]],
    ['lessThan', '2024-01-15', undefined, [4]],
    ['lessThanOrEqual', '2024-01-15', undefined, [1, 2, 4]],
    ['between', '2024-01-15', '2024-01-16', [1, 2, 3]],
    ['between', '2024-01-16', '2024-01-15', [1, 2, 3]],
    ['blank', undefined, undefined, [5]],
    ['notBlank', undefined, undefined, [1, 2, 3, 4, 6, 7]],
  ])('%s %p %p', (operator, value, valueTo, expected) => {
    expect(filterIds(items, dateCol, date(operator, value, valueTo))).toEqual(expected);
  });

  it('ignores an unparsable date operand', () => {
    expect(filterIds(items, dateCol, date('greaterThan', 'someday'))).toHaveLength(items.length);
  });
});

describe('condition filter helpers', () => {
  it('resolveConditionFilterKind follows filterable.type and the column type', () => {
    expect(resolveConditionFilterKind({ filterable: { type: 'number' } })).toBe('number');
    expect(resolveConditionFilterKind({ type: 'numeric', filterable: { type: 'condition' } })).toBe('number');
    expect(resolveConditionFilterKind({ type: 'date', filterable: { type: 'condition' } })).toBe('date');
    expect(resolveConditionFilterKind({ filterable: { type: 'condition' } })).toBe('text');
    expect(resolveConditionFilterKind({ filterable: { type: 'text' } })).toBeUndefined();
  });

  it('operator metadata', () => {
    expect(CONDITION_OPERATORS.number).toContain('top');
    expect(CONDITION_OPERATORS.text).not.toContain('top');
    expect(CONDITION_OPERATORS.date).toContain('between');
    expect(getConditionOperatorArity('between')).toBe(2);
    expect(getConditionOperatorArity('blank')).toBe(0);
    expect(getConditionOperatorArity('aboveAverage')).toBe(0);
    expect(getConditionOperatorArity('top')).toBe(1);
    expect(getConditionOperatorLabel('greaterThan')).toBe('Greater than');
    expect(getConditionOperatorLabel('greaterThan', 'date')).toBe('Is after');
  });

  it('normalizeConditionFilter drops incomplete conditions and the join of a single condition', () => {
    expect(normalizeConditionFilter({ kind: 'number', conditions: [{ operator: 'equals' }] })).toBeUndefined();
    expect(normalizeConditionFilter(undefined)).toBeUndefined();
    expect(
      normalizeConditionFilter({ kind: 'number', conditions: [{ operator: 'equals', value: 1 }, { operator: 'lessThan' }], join: 'or' }),
    ).toEqual({ kind: 'number', conditions: [{ operator: 'equals', value: 1 }] });
    expect(
      normalizeConditionFilter({ kind: 'text', conditions: [{ operator: 'blank' }, { operator: 'equals', value: 'x' }], join: 'or' }),
    ).toEqual({ kind: 'text', conditions: [{ operator: 'blank' }, { operator: 'equals', value: 'x' }], join: 'or' });
  });

  it('mergeFilter removes a condition filter without complete conditions', () => {
    const prev: IFilters = { v: { type: 'condition', value: { kind: 'number', conditions: [{ operator: 'equals', value: 1 }] } } };
    expect(mergeFilter(prev, 'v', { type: 'condition', value: { kind: 'number', conditions: [] } })).toEqual({});
    const next = mergeFilter({}, 'v', { type: 'condition', value: { kind: 'number', conditions: [{ operator: 'blank' }] } });
    expect(next.v?.type).toBe('condition');
  });

  it('the filter model is JSON-serializable', () => {
    const filters: IFilters = {
      v: { type: 'condition', value: { kind: 'number', conditions: [{ operator: 'between', value: 1, valueTo: 5 }, { operator: 'blank' }], join: 'or' } },
    };
    expect(JSON.parse(JSON.stringify(filters))).toEqual(filters);
  });
});

describe('shouldUseWorkerSort with a sort model', () => {
  it('falls back to sync when any level has a custom compare', () => {
    const many = 10_000;
    expect(shouldUseWorkerSort(true, many, { columns: peopleColumns, sortModel: [{ field: 'age', direction: 'asc' }] })).toBe(true);
    expect(
      shouldUseWorkerSort(true, many, {
        columns: peopleColumns,
        sortModel: [{ field: 'age', direction: 'asc' }, { field: 'level', direction: 'asc' }],
      }),
    ).toBe(false);
  });
});

describe('getHeaderFilterConfig sort levels and condition filters', () => {
  const onColumnSort = jest.fn();
  const onFilterChange = jest.fn();
  const base = {
    sortDirection: 'asc' as const,
    onColumnSort,
    filters: {} as IFilters,
    onFilterChange,
    filterOptions: {},
    loadingFilterOptions: {},
  };

  beforeEach(() => {
    onColumnSort.mockClear();
    onFilterChange.mockClear();
  });

  it('shows the sort priority only for multi-level sorts', () => {
    const col = peopleColumns[1] as IColumnDef<Person>;
    const single = getHeaderFilterConfig(col, { ...base, sortBy: 'age', sortModel: [{ field: 'age', direction: 'asc' }] });
    expect(single.isSorted).toBe(true);
    expect(single.sortIndex).toBeUndefined();
    const multi = getHeaderFilterConfig(col, {
      ...base,
      sortBy: 'dept',
      sortModel: [{ field: 'dept', direction: 'asc' }, { field: 'age', direction: 'desc' }],
    });
    expect(multi).toMatchObject({ isSorted: true, isSortedDescending: true, sortIndex: 2 });
  });

  it('onSort passes the additive flag through', () => {
    const config = getHeaderFilterConfig(peopleColumns[0] as IColumnDef<Person>, base);
    config.onSort?.();
    expect(onColumnSort).toHaveBeenLastCalledWith('dept');
    config.onSort?.({ additive: true });
    expect(onColumnSort).toHaveBeenLastCalledWith('dept', undefined, { additive: true });
  });

  it('builds number/condition filter props and normalizes changes', () => {
    const col: IColumnDef<Person> = { columnId: 'age', name: 'Age', type: 'numeric', filterable: { type: 'condition' } };
    const value: IConditionFilterValue = { kind: 'number', conditions: [{ operator: 'greaterThan', value: 3 }] };
    const config = getHeaderFilterConfig(col, { ...base, filters: { age: { type: 'condition', value } } });
    expect(config.conditionKind).toBe('number');
    expect(config.conditionValue).toBe(value);
    config.onConditionChange?.({ kind: 'number', conditions: [{ operator: 'lessThan' }] });
    expect(onFilterChange).toHaveBeenLastCalledWith('age', undefined);
    config.onConditionChange?.(value);
    expect(onFilterChange).toHaveBeenLastCalledWith('age', { type: 'condition', value });
  });
});
