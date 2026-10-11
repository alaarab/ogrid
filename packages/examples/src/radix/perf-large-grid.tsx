/**
 * Large-grid benchmark page: 2,000 rows x 20 columns with custom React cell
 * renderers (badges, avatar stacks, two-line cells), editing and range
 * selection. Driven by e2e/perf/largeGrid.bench.ts through `window.__perf`.
 *
 * Query flags:
 *   rows=N          row count (default 2000)
 *   virtual=1       enable row virtualization (default: render every row, like pageSize 'all')
 *   cols=unstable   rebuild the column definitions on every parent render
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OGrid } from '@alaarab/ogrid-react-radix';
import type { IColumnDef, IOGridApi } from '@alaarab/ogrid-react-radix';

interface Person { id: number; name: string; color: string }
interface PerfRow {
  id: string;
  name: string;
  source: string;
  category: string;
  hubCategory: string | null;
  status: string;
  reorg: string;
  reviewers: Person[];
  people: number;
  lobs: string[];
  issues: string[];
  comments: number;
  views: number;
  reason: string;
  owner: Person | null;
  retireDate: string;
  halo: string;
  notes: string;
  hubReport: string | null;
  lastViewed: string;
  ppStatus: string;
  amount: number;
  lastSeen: string;
}

const params = new URLSearchParams(window.location.search);
const ROW_COUNT = Number(params.get('rows') ?? 2000);
const VIRTUAL = params.get('virtual') === '1';
const UNSTABLE_COLUMNS = params.get('cols') === 'unstable';

const STATUSES = ['keep', 'retire', 'review', 'merge'];
const STATUS_COLORS: Record<string, string> = { keep: '#0a7d32', retire: '#b45309', review: '#1d4ed8', merge: '#7c3aed' };
const NAMES = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Edsger Dijkstra', 'Barbara Liskov', 'Ken Thompson', 'Margaret Hamilton', 'Donald Knuth'];
const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
const LOBS = ['Finance', 'Operations', 'Safety', 'HR', 'Engineering', 'Sales'];
const ISSUES = ['Missing owner', 'Stale', 'Broken link'];

// Deterministic PRNG so every version renders identical data.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function makeRows(count: number): PerfRow[] {
  const rand = rng(42);
  const pick = <V,>(arr: readonly V[]): V => arr[Math.floor(rand() * arr.length)] as V;
  let personId = 0;
  const person = (): Person => ({ id: personId++, name: pick(NAMES), color: pick(COLORS) });
  const rows: PerfRow[] = [];
  for (let i = 0; i < count; i++) {
    const reviewerCount = Math.floor(rand() * 6);
    const lobCount = Math.floor(rand() * 4);
    rows.push({
      id: `r${i}`,
      name: `Report ${String(i).padStart(4, '0')} ${pick(['Revenue', 'Headcount', 'Incidents', 'Backlog', 'Utilization'])}`,
      source: pick(['Power BI', 'SSRS', 'Excel']),
      category: pick(['Finance', 'Operations', 'Safety', 'People']),
      hubCategory: rand() < 0.3 ? pick(['Accounting', 'HSSE', 'Hiring']) : null,
      status: pick(STATUSES),
      reorg: pick(['yes', 'no', 'unknown']),
      reviewers: Array.from({ length: reviewerCount }, person),
      people: Math.floor(rand() * 500),
      lobs: Array.from({ length: lobCount }, () => pick(LOBS)),
      issues: rand() < 0.25 ? [pick(ISSUES)] : [],
      comments: Math.floor(rand() * 20),
      views: Math.floor(rand() * 2000),
      reason: rand() < 0.4 ? pick(['Duplicate', 'Unused', 'Replaced']) : '',
      owner: rand() < 0.7 ? person() : null,
      retireDate: rand() < 0.3 ? `2026-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-15` : '',
      halo: rand() < 0.2 ? `HAL-${Math.floor(rand() * 9000) + 1000}` : '',
      notes: rand() < 0.5 ? 'Checked with the owner, follow up next quarter' : '',
      hubReport: rand() < 0.4 ? `Hub report ${i}` : null,
      lastViewed: `2026-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}`,
      ppStatus: rand() < 0.8 ? 'Active' : 'Inactive',
      amount: Math.round(rand() * 1_000_000) / 100,
      lastSeen: `${Math.floor(rand() * 30)} days ago`,
    });
  }
  return rows;
}

// --- Instrumentation -------------------------------------------------------

const perf = {
  /** Custom renderCell invocations (one per rendered custom cell). */
  cellRenders: 0,
  /** Parent (App) renders. */
  appRenders: 0,
  initialRenderMs: -1,
  longTasks: [] as { start: number; duration: number }[],
  events: [] as { name: string; duration: number; processing: number; start: number }[],
  api: null as IOGridApi<PerfRow> | null,
  bumpParent: () => {},
  reset() {
    perf.cellRenders = 0;
    perf.appRenders = 0;
    perf.longTasks = [];
    perf.events = [];
  },
};
(window as unknown as { __perf: typeof perf }).__perf = perf;

try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) perf.longTasks.push({ start: e.startTime, duration: e.duration });
  }).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries() as PerformanceEventTiming[]) {
      perf.events.push({ name: e.name, duration: e.duration, processing: e.processingEnd - e.processingStart, start: e.startTime });
    }
  }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
} catch {
  // Observers are best-effort.
}

const count = <A extends unknown[], R>(fn: (...args: A) => R) => (...args: A): R => {
  perf.cellRenders++;
  return fn(...args);
};

// --- Hub-like cell renderers ----------------------------------------------

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '0 6px', borderRadius: 9999, fontSize: 11, lineHeight: '18px', background: `${color}22`, color, border: `1px solid ${color}55` }}>
      {label}
    </span>
  );
}

function Avatar({ person, ring }: { person: Person; ring?: boolean }) {
  const initials = person.name.split(' ').map((p) => p[0]).join('');
  return (
    <span
      title={person.name}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: person.color, color: '#fff', fontSize: 9, fontWeight: 600, marginLeft: ring ? -6 : 0, boxShadow: ring ? '0 0 0 2px #fff' : undefined }}
    >
      {initials}
    </span>
  );
}

function AvatarStack({ people }: { people: Person[] }) {
  if (people.length === 0) return <span style={{ color: '#888', fontSize: 11 }}>None</span>;
  const shown = people.slice(0, 3);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {shown.map((p, i) => <Avatar key={p.id} person={p} ring={i > 0} />)}
      {people.length > 3 && <span style={{ marginLeft: 4, fontSize: 11, color: '#555' }}>+{people.length - 3}</span>}
    </span>
  );
}

function TwoLine({ top, bottom }: { top: React.ReactNode; bottom?: React.ReactNode }) {
  return (
    <span style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{top}</span>
      {bottom && <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11, color: '#666' }}>{bottom}</span>}
    </span>
  );
}

function buildColumns(onOpen: (row: PerfRow) => void): IColumnDef<PerfRow>[] {
  return [
    {
      columnId: 'open', name: '', pinned: 'left', defaultWidth: 44, sortable: false, valueGetter: () => '',
      renderCell: count((r: PerfRow) => <button type="button" aria-label={`Open ${r.name}`} onClick={() => onOpen(r)} style={{ border: 0, background: 'none', cursor: 'pointer' }}>⧉</button>),
    },
    {
      columnId: 'name', name: 'Report', pinned: 'left', defaultWidth: 260, filterable: { type: 'text' }, valueGetter: (r) => r.name,
      renderCell: count((r: PerfRow) => <TwoLine top={r.name} bottom={r.source} />),
    },
    {
      columnId: 'status', name: 'Status', defaultWidth: 120, editable: true, cellEditor: 'select', cellEditorParams: { values: STATUSES },
      filterable: { type: 'multiSelect' }, valueGetter: (r) => r.status,
      renderCell: count((r: PerfRow) => <Badge label={r.status} color={STATUS_COLORS[r.status] ?? '#555'} />),
    },
    {
      columnId: 'category', name: 'Category', defaultWidth: 150, filterable: { type: 'multiSelect' }, valueGetter: (r) => r.category,
      renderCell: count((r: PerfRow) => <TwoLine top={r.category} bottom={r.hubCategory ? `Hub: ${r.hubCategory}` : undefined} />),
    },
    {
      columnId: 'reorg', name: 'Re-org', defaultWidth: 110, editable: true, cellEditor: 'select', cellEditorParams: { values: ['yes', 'no', 'unknown'] },
      valueGetter: (r) => r.reorg,
      renderCell: count((r: PerfRow) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge label={r.reorg} color={r.reorg === 'yes' ? '#b91c1c' : '#475569'} />
          {r.reorg === 'unknown' && <span style={{ width: 6, height: 6, borderRadius: 3, background: '#f59e0b' }} />}
        </span>
      )),
    },
    {
      columnId: 'reviewers', name: 'Reviewed by', defaultWidth: 140, valueGetter: (r) => r.reviewers.map((p) => p.name).join(', '),
      renderCell: count((r: PerfRow) => <AvatarStack people={r.reviewers} />),
    },
    {
      columnId: 'access', name: 'Access', type: 'numeric', defaultWidth: 170, filterable: { type: 'number' } as never, valueGetter: (r) => r.people,
      renderCell: count((r: PerfRow) => (
        <span data-perf-two-line="" style={{ display: 'block', minWidth: 0, fontSize: 12 }}>
          <span data-perf-line="1" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.people}</span>
          {r.lobs.length > 0 && <span data-perf-line="2" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', color: '#666' }}>{r.lobs.join(', ')}</span>}
        </span>
      )),
    },
    {
      columnId: 'sync', name: 'Sync', defaultWidth: 130, valueGetter: (r) => (r.issues.length ? r.issues.join(', ') : 'OK'),
      renderCell: count((r: PerfRow) => (r.issues.length === 0
        ? <span style={{ color: '#888', fontSize: 11 }}>OK</span>
        : <span style={{ display: 'flex', gap: 4 }}>{r.issues.map((i) => <Badge key={i} label={i} color="#b45309" />)}</span>)),
    },
    { columnId: 'comments', name: 'Comments', type: 'numeric', defaultWidth: 90, valueGetter: (r) => r.comments },
    { columnId: 'views', name: 'Views (90d)', type: 'numeric', defaultWidth: 100, valueGetter: (r) => r.views, valueFormatter: (v) => String(v ?? 0) },
    { columnId: 'reason', name: 'Reason', defaultWidth: 130, editable: true, cellEditor: 'text', valueGetter: (r) => r.reason },
    {
      columnId: 'owner', name: 'Owner', defaultWidth: 160, valueGetter: (r) => r.owner?.name ?? '',
      renderCell: count((r: PerfRow) => (r.owner
        ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><Avatar person={r.owner} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.owner.name}</span></span>
        : null)),
    },
    { columnId: 'retireDate', name: 'Retire date', type: 'date', defaultWidth: 120, editable: true, cellEditor: 'date', valueGetter: (r) => r.retireDate },
    { columnId: 'halo', name: 'Halo', defaultWidth: 110, editable: true, cellEditor: 'text', valueGetter: (r) => r.halo },
    { columnId: 'notes', name: 'Notes', defaultWidth: 220, editable: true, cellEditor: 'text', valueGetter: (r) => r.notes },
    {
      columnId: 'hub', name: 'Hub report', defaultWidth: 160, valueGetter: (r) => r.hubReport ?? '',
      renderCell: count((r: PerfRow) => (r.hubReport ? <a href={`#${r.id}`} style={{ color: '#2563eb' }}>{r.hubReport}</a> : null)),
    },
    { columnId: 'lastViewed', name: 'Last viewed', type: 'date', defaultWidth: 120, valueGetter: (r) => r.lastViewed },
    { columnId: 'ppStatus', name: 'PP status', defaultWidth: 100, filterable: { type: 'multiSelect' }, valueGetter: (r) => r.ppStatus },
    { columnId: 'amount', name: 'Amount', type: 'numeric', defaultWidth: 110, editable: true, cellEditor: 'text', valueGetter: (r) => r.amount },
    { columnId: 'lastSeen', name: 'Last seen', defaultWidth: 110, valueGetter: (r) => r.lastSeen },
  ];
}

const getRowId = (r: PerfRow) => r.id;
const INITIAL_ROWS = makeRows(ROW_COUNT);
const VIRTUAL_SCROLL = { enabled: true, rowHeight: 44 };

function App() {
  perf.appRenders++;
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [, setTick] = useState(0);
  const apiRef = useRef<IOGridApi<PerfRow> | null>(null);
  perf.bumpParent = () => setTick((t) => t + 1);

  const onOpen = useCallback((_row: PerfRow) => {}, []);
  const stableColumns = useMemo(() => buildColumns(onOpen), [onOpen]);
  const columns = UNSTABLE_COLUMNS ? buildColumns((_row: PerfRow) => {}) : stableColumns;

  const onCellValueChanged = useCallback((e: { item: PerfRow; columnId: string; newValue: unknown }) => {
    setRows((prev) => prev.map((r) => (r.id === e.item.id ? { ...r, [e.columnId]: e.newValue } : r)));
  }, []);

  useEffect(() => {
    perf.api = apiRef.current;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (perf.initialRenderMs < 0) perf.initialRenderMs = performance.now() - mountStart;
    }));
  }, []);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 8 }}>
      <OGrid<PerfRow>
        ref={apiRef as never}
        columns={columns as never}
        data={rows}
        getRowId={getRowId}
        editable
        onCellValueChanged={UNSTABLE_COLUMNS ? (e) => onCellValueChanged(e as never) : (onCellValueChanged as never)}
        density="compact"
        statusBar
        stickyHeader
        defaultPageSize="all"
        virtualScroll={VIRTUAL ? VIRTUAL_SCROLL : undefined}
        aria-label="Large grid benchmark"
      />
    </div>
  );
}

const mountStart = performance.now();
const rootEl = document.getElementById('root');
if (rootEl) createRoot(rootEl).render(<App />);
