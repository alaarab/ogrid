/**
 * Performance benchmark suite for core utilities.
 * Run with: npx tsx packages/core/src/__benchmarks__/performance.bench.ts
 */

import { processClientSideData } from '../utils/clientSideData';
import { flattenColumns, buildHeaderRows } from '../utils/columnUtils';
import { formatSelectionAsTsv } from '../utils/clipboardHelpers';
import { normalizeSelectionRange } from '../types/dataGridTypes';
import type { IColumnDef, IColumnGroupDef } from '../types/columnTypes';
import type { IFilters, ISelectionRange } from '../types/dataGridTypes';

// ---------------------------------------------------------------------------
// Realistic test data types
// ---------------------------------------------------------------------------

interface Row {
  id: number;
  name: string;
  email: string;
  date: string;
  amount: number;
  category: string;
  status: string;
  region: string;
  score: number;
  tag: string;
}

// ---------------------------------------------------------------------------
// Data generators
// ---------------------------------------------------------------------------

const CATEGORIES = ['Electronics', 'Clothing', 'Food', 'Books', 'Sports'];
const STATUSES = ['active', 'inactive', 'pending'];
const REGIONS = ['North', 'South', 'East', 'West', 'Central'];
const TAGS = ['promo', 'sale', 'new', 'featured', 'clearance'];
const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Hank', 'Iris', 'Jack'];
const LAST_NAMES = ['Smith', 'Jones', 'Brown', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson'];

function generateRows(count: number): Row[] {
  const rows: Row[] = [];
  const baseDate = new Date('2020-01-01').getTime();
  const msPerDay = 86400000;
  const totalDays = 365 * 4; // 4 years of dates

  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const dateMs = baseDate + ((i * 7) % totalDays) * msPerDay;
    const d = new Date(dateMs);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    rows.push({
      id: i + 1,
      name,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      date: dateStr,
      amount: Math.round((10 + (i % 990)) * 100) / 100,
      category: CATEGORIES[i % CATEGORIES.length],
      status: STATUSES[i % STATUSES.length],
      region: REGIONS[i % REGIONS.length],
      score: (i * 37) % 101,
      tag: TAGS[i % TAGS.length],
    });
  }
  return rows;
}

function makeColumns(): IColumnDef<Row>[] {
  return [
    { columnId: 'id', name: 'ID', type: 'numeric' },
    { columnId: 'name', name: 'Name' },
    { columnId: 'email', name: 'Email' },
    { columnId: 'date', name: 'Date', type: 'date' },
    { columnId: 'amount', name: 'Amount', type: 'numeric' },
    { columnId: 'category', name: 'Category' },
    { columnId: 'status', name: 'Status' },
    { columnId: 'region', name: 'Region' },
    { columnId: 'score', name: 'Score', type: 'numeric' },
    { columnId: 'tag', name: 'Tag' },
  ];
}

/** Build a deeply nested column tree: groups with 3 levels, ~100 leaf columns. */
function makeNestedColumnTree(): (IColumnGroupDef<Row> | IColumnDef<Row>)[] {
  // We'll create 10 top-level groups, each with 2 sub-groups, each with 5 leaf columns = 100 leaves total.
  const tree: (IColumnGroupDef<Row> | IColumnDef<Row>)[] = [];
  let colIdx = 0;
  for (let g = 0; g < 10; g++) {
    const subGroups: (IColumnGroupDef<Row> | IColumnDef<Row>)[] = [];
    for (let sg = 0; sg < 2; sg++) {
      const leaves: IColumnDef<Row>[] = [];
      for (let l = 0; l < 5; l++) {
        const id = `col_${colIdx++}`;
        leaves.push({ columnId: id, name: `Col ${colIdx}` });
      }
      subGroups.push({ headerName: `SubGroup ${g}_${sg}`, children: leaves });
    }
    tree.push({ headerName: `Group ${g}`, children: subGroups });
  }
  return tree;
}

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

interface BenchResult {
  operation: string;
  size: string;
  timeMs: number;
  iterations: number;
}

function bench(
  operation: string,
  size: string,
  fn: () => void,
  iterations = 1
): BenchResult {
  // Warm up
  fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  const totalMs = end - start;
  const timeMs = iterations > 1 ? totalMs / iterations : totalMs;

  return { operation, size, timeMs, iterations };
}

function formatTable(results: BenchResult[]): void {
  const COL_OP = 38;
  const COL_SIZE = 12;
  const COL_TIME = 10;
  const COL_ITER = 10;

  const border = (left: string, mid: string, right: string, fill: string) =>
    left +
    fill.repeat(COL_OP + 2) +
    mid +
    fill.repeat(COL_SIZE + 2) +
    mid +
    fill.repeat(COL_TIME + 2) +
    mid +
    fill.repeat(COL_ITER + 2) +
    right;

  const row = (op: string, size: string, time: string, iter: string) =>
    `│ ${op.padEnd(COL_OP)} │ ${size.padEnd(COL_SIZE)} │ ${time.padStart(COL_TIME)} │ ${iter.padStart(COL_ITER)} │`;

  console.log('\n' + border('┌', '┬', '┐', '─'));
  console.log(row('Operation', 'Size', 'Time (ms)', 'Iterations'));
  console.log(border('├', '┼', '┤', '─'));

  for (const r of results) {
    const timeStr = r.timeMs < 1 ? r.timeMs.toFixed(4) : r.timeMs.toFixed(2);
    console.log(row(r.operation, r.size, timeStr, String(r.iterations)));
  }

  console.log(border('└', '┴', '┘', '─'));
}

// ---------------------------------------------------------------------------
// Main benchmark suite
// ---------------------------------------------------------------------------

function runBenchmarks(): void {
  console.log('OGrid Core Performance Benchmarks');
  console.log('==================================');

  const results: BenchResult[] = [];

  // --- processClientSideData ---

  const rows10k = generateRows(10_000);
  const rows50k = generateRows(50_000);
  const columns = makeColumns();

  // Text filter  -  matches ~50% of rows (names starting with A-E = Alice/Bob/Carol/Dave/Eve)
  const textFilter: IFilters = { name: { type: 'text', value: 'a' } };
  results.push(bench('processClientSideData (text filter)', '10k rows', () => {
    processClientSideData(rows10k, columns, textFilter);
  }));
  results.push(bench('processClientSideData (text filter)', '50k rows', () => {
    processClientSideData(rows50k, columns, textFilter);
  }));

  // MultiSelect filter  -  3 values, matches ~30% of rows (3/10 categories cycling)
  const multiFilter: IFilters = { category: { type: 'multiSelect', value: ['Electronics', 'Food', 'Sports'] } };
  results.push(bench('processClientSideData (multiSelect)', '10k rows', () => {
    processClientSideData(rows10k, columns, multiFilter);
  }));
  results.push(bench('processClientSideData (multiSelect)', '50k rows', () => {
    processClientSideData(rows50k, columns, multiFilter);
  }));

  // Sort by string column
  const noFilter: IFilters = {};
  results.push(bench('processClientSideData (sort string)', '10k rows', () => {
    processClientSideData(rows10k, columns, noFilter, 'name', 'asc');
  }));
  results.push(bench('processClientSideData (sort string)', '50k rows', () => {
    processClientSideData(rows50k, columns, noFilter, 'name', 'asc');
  }));

  // Sort by date column
  results.push(bench('processClientSideData (sort date)', '10k rows', () => {
    processClientSideData(rows10k, columns, noFilter, 'date', 'asc');
  }));
  results.push(bench('processClientSideData (sort date)', '50k rows', () => {
    processClientSideData(rows50k, columns, noFilter, 'date', 'asc');
  }));

  // Combined filter + sort
  results.push(bench('processClientSideData (filter+sort)', '10k rows', () => {
    processClientSideData(rows10k, columns, textFilter, 'date', 'desc');
  }));
  results.push(bench('processClientSideData (filter+sort)', '50k rows', () => {
    processClientSideData(rows50k, columns, textFilter, 'date', 'desc');
  }));

  // --- flattenColumns ---

  const nestedTree = makeNestedColumnTree();
  results.push(bench('flattenColumns', '100 cols / 3 levels', () => {
    flattenColumns(nestedTree);
  }, 1_000));

  // --- buildHeaderRows ---

  results.push(bench('buildHeaderRows', '100 cols / 3 levels', () => {
    buildHeaderRows(nestedTree);
  }, 1_000));

  // --- formatSelectionAsTsv ---

  const tsvCols = makeColumns(); // 10 columns
  const range1000x10: ISelectionRange = { startRow: 0, startCol: 0, endRow: 999, endCol: 9 };
  results.push(bench('formatSelectionAsTsv', '1000r × 10c', () => {
    formatSelectionAsTsv(rows10k, tsvCols, range1000x10);
  }));

  // --- normalizeSelectionRange (micro-benchmark) ---

  const fwdRange: ISelectionRange = { startRow: 5, startCol: 3, endRow: 100, endCol: 20 };
  const revRange: ISelectionRange = { startRow: 100, startCol: 20, endRow: 5, endCol: 3 };
  results.push(bench('normalizeSelectionRange (forward)', '100k calls', () => {
    for (let i = 0; i < 100_000; i++) {
      normalizeSelectionRange(fwdRange);
    }
  }));
  results.push(bench('normalizeSelectionRange (reversed)', '100k calls', () => {
    for (let i = 0; i < 100_000; i++) {
      normalizeSelectionRange(revRange);
    }
  }));

  formatTable(results);

  const slowOps = results.filter(r => r.timeMs > 500);
  if (slowOps.length > 0) {
    console.log('\nWARNING: The following operations exceeded 500ms:');
    for (const op of slowOps) {
      console.log(`  - ${op.operation} (${op.size}): ${op.timeMs.toFixed(2)}ms`);
    }
  } else {
    console.log('\nAll operations completed within acceptable time limits.');
  }
}

runBenchmarks();
