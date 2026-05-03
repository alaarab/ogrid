import React, { useState, useEffect, useMemo, useRef, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import Link from '@docusaurus/Link';
import styles from './index.module.scss';

/* ──────────────────────────────────────────────
   Hero Grid  -  Real OGrid with 10K rows
   ────────────────────────────────────────────── */

interface EmployeeRow {
  id: number;
  name: string;
  department: string;
  title: string;
  email: string;
  salary: number;
  startDate: string;
  status: string;
  rating: number;
  remote: boolean;
  color: string;
  tags: string;
}

const FIRST_NAMES = ['James','Emma','Liam','Olivia','Noah','Ava','William','Sophia','Benjamin','Isabella','Lucas','Mia','Henry','Charlotte','Alexander','Amelia','Daniel','Harper','Matthew','Evelyn','Sebastian','Abigail','Jack','Emily','Aiden','Elizabeth','Owen','Sofia','Samuel','Avery','Ryan','Ella','Nathan','Scarlett','Leo','Grace','Isaac','Lily','Ethan','Chloe','Mason','Penelope','Logan','Layla','Jacob','Riley','Michael','Zoey','Elijah','Nora'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts'];
const DEPARTMENTS = ['Engineering','Product','Design','Marketing','Sales','Finance','HR','Legal','Operations','Support'];
const TITLES = ['Software Engineer','Product Manager','UX Designer','Data Analyst','Sales Executive','Account Manager','HR Specialist','Legal Counsel','DevOps Engineer','Support Lead','Frontend Developer','Backend Developer','QA Engineer','Scrum Master','Tech Lead','Marketing Manager','Content Strategist','BD Manager','Recruiter','Finance Analyst'];
const STATUSES: string[] = ['Active','Active','Active','Active','Active','Active','Active','Remote','Remote','On Leave'];
const STATUSES_UNIQUE = [...new Set(STATUSES)];
const COLORS = ['#FF6B6B', '#4D96FF', '#6BCB77', '#FFD93D', '#A66DD4', '#FF8E72', '#00B894', '#0984E3', '#FD79A8', '#E17055'];
const TAGS = ['React, TypeScript', 'Angular, Java', 'Vue, Python', 'React, Node', 'Python, ML', 'Go, Docker', 'React, AWS', 'Angular, Azure', 'Vue, GraphQL', 'TypeScript, Rust'];

const ROW_COUNT = 10_000;

function generateData(): EmployeeRow[] {
  const rows: EmployeeRow[] = [];
  for (let i = 0; i < ROW_COUNT; i++) {
    const firstName = FIRST_NAMES[i % 50];
    const lastName = LAST_NAMES[(i * 7 + 3) % 50];
    rows.push({
      id: i + 1,
      name: `${firstName} ${lastName}`,
      department: DEPARTMENTS[i % 10],
      title: TITLES[i % 20],
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@acme.co`,
      salary: 52000 + ((i * 137) % 148) * 1000,
      startDate: `${2019 + (i % 6)}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + ((i * 3) % 28)).padStart(2, '0')}`,
      status: STATUSES[i % 10],
      rating: 1 + (i % 5),
      remote: i % 5 === 0 || i % 7 === 0,
      color: COLORS[i % 10],
      tags: TAGS[i % 10],
    });
  }
  return rows;
}

const toolbarBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 600,
  fontFamily: 'inherit',
  color: 'var(--ogrid-fg, #242424)',
  background: 'transparent',
  border: '1px solid var(--ogrid-border, #e0e0e0)',
  borderRadius: 4,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
};

function HeroGrid() {
  const { OGrid, exportToCsv } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  const { RatingEditor, ColorPickerEditor, SliderEditor, TagsEditor } = require('@alaarab/ogrid-react-inputs') as typeof import('@alaarab/ogrid-react-inputs');
  type ApiType = import('@alaarab/ogrid-react-radix').IOGridApi<EmployeeRow>;
  type IFilters = import('@alaarab/ogrid-react-radix').IFilters;

  const apiRef = useRef<ApiType>(null);
  const [data, setData] = useState<EmployeeRow[]>(() => generateData());
  const [filters, setFilters] = useState<IFilters>({});
  const [density, setDensity] = useState<'compact' | 'normal' | 'comfortable'>('normal');

  const handleCellValueChanged = useCallback((e: { item: EmployeeRow; columnId: string; newValue: unknown }) => {
    setData(prev => prev.map(row =>
      row.id === e.item.id ? { ...row, [e.columnId]: e.newValue } : row
    ));
  }, []);

  const columns = useMemo(() => [
    { columnId: 'name', name: 'Name', sortable: true, editable: true, defaultWidth: 170 },
    { columnId: 'department', name: 'Department', sortable: true, editable: true, filterable: { type: 'multiSelect' as const }, cellEditor: 'richSelect' as const, cellEditorParams: { values: DEPARTMENTS }, defaultWidth: 145 },
    { columnId: 'title', name: 'Title', sortable: true, editable: true, filterable: { type: 'text' as const }, defaultWidth: 180 },
    { columnId: 'email', name: 'Email', editable: true, defaultWidth: 200 },
    { columnId: 'salary', name: 'Salary', type: 'numeric' as const, editable: true, valueFormatter: (v: unknown) => v != null ? `$${Number(v).toLocaleString()}` : '', defaultWidth: 110 },
    { columnId: 'startDate', name: 'Start Date', type: 'date' as const, sortable: true, editable: true, defaultWidth: 130 },
    { columnId: 'remote', name: 'Remote', type: 'boolean' as const, editable: true, sortable: true, filterable: { type: 'multiSelect' as const }, defaultWidth: 110 },
    { columnId: 'status', name: 'Status', editable: true, filterable: { type: 'multiSelect' as const }, cellEditor: 'richSelect' as const, cellEditorParams: { values: STATUSES_UNIQUE }, defaultWidth: 120 },
    { columnId: 'rating', name: 'Rating', sortable: true, editable: true, filterable: { type: 'multiSelect' as const }, cellEditor: RatingEditor, cellEditorPopup: true, cellEditorParams: { maxStars: 5 }, defaultWidth: 120 },
    { columnId: 'color', name: 'Color', editable: true, cellEditor: ColorPickerEditor, cellEditorPopup: true, defaultWidth: 110, valueFormatter: (v: unknown) => v ? String(v) : '' },
    { columnId: 'tags', name: 'Skills', editable: true, cellEditor: TagsEditor, cellEditorPopup: true, cellEditorParams: { suggestions: ['React', 'Angular', 'Vue', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'Node', 'Docker', 'AWS', 'Azure', 'GraphQL', 'ML'] }, defaultWidth: 160 },
  ], [RatingEditor, ColorPickerEditor, TagsEditor]);

  const handleExportCsv = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const rows = api.getDisplayedRows();
    exportToCsv(rows, columns, (item, colId) => {
      const val = (item as Record<string, unknown>)[colId];
      return val != null ? String(val) : '';
    }, 'ogrid-employees.csv');
  }, [columns, exportToCsv]);

  const handleClearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const hasActiveFilters = Object.keys(filters).length > 0;

  const densityOptions: Array<{ value: 'compact' | 'normal' | 'comfortable'; label: string; icon: string }> = [
    { value: 'compact', label: 'Compact', icon: '☰' },
    { value: 'normal', label: 'Normal', icon: '≡' },
    { value: 'comfortable', label: 'Comfortable', icon: '☷' },
  ];

  const toolbar = useMemo(() => (
    <>
      <button style={toolbarBtnStyle} onClick={handleExportCsv} title="Export to CSV">
        Export CSV
      </button>
      <button
        style={{
          ...toolbarBtnStyle,
          opacity: hasActiveFilters ? 1 : 0.5,
          cursor: hasActiveFilters ? 'pointer' : 'not-allowed',
        }}
        onClick={handleClearFilters}
        title="Clear all filters"
        disabled={!hasActiveFilters}
      >
        Clear Filters
      </button>
      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: 4, overflow: 'hidden' }}>
        {densityOptions.map((opt, idx) => (
          <button
            key={opt.value}
            onClick={() => setDensity(opt.value)}
            title={`${opt.label} density`}
            style={{
              ...toolbarBtnStyle,
              border: 'none',
              borderRadius: 0,
              borderRight: idx < densityOptions.length - 1 ? '1px solid var(--ogrid-border, #e0e0e0)' : 'none',
              background: density === opt.value ? 'var(--ogrid-selection-color, #217346)' : 'transparent',
              color: density === opt.value ? 'white' : 'var(--ogrid-fg, #242424)',
              minWidth: 32,
            }}
          >
            <span title={opt.label}>{opt.icon}</span>
          </button>
        ))}
      </div>
    </>
  ), [handleExportCsv, handleClearFilters, hasActiveFilters, density, densityOptions]);

  return (
    <div className={styles.heroGridWrapper}>
      <OGrid
        ref={apiRef}
        columns={columns}
        data={data}
        getRowId={(row: EmployeeRow) => row.id}
        editable
        cellSelection
        statusBar
        sideBar
        toolbar={toolbar}
        filters={filters}
        onFiltersChange={setFilters}
        onCellValueChanged={handleCellValueChanged}
        density={density}
        defaultPageSize={100}
        entityLabelPlural="employees"
        formulas
        cellReferences
        initialFormulas={[
          { col: 4, row: 4, formula: '=SUM(E1:E4)' },
          { col: 4, row: 5, formula: '=AVERAGE(E1:E4)' },
          { col: 4, row: 6, formula: '=MAX(E1:E4)' },
          { col: 4, row: 7, formula: '=MIN(E1:E4)' },
          { col: 8, row: 4, formula: '=AVERAGE(I1:I4)' },
        ]}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────
   Feature Ticker
   ────────────────────────────────────────────── */

const tickerFeatures = [
  'Virtual Scrolling', 'Cell Editing', 'Multi-Select Filters', 'Clipboard', 'Fill Handle',
  'Undo / Redo', 'Column Pinning', 'Row Selection', 'Server-Side Data', 'CSV Export',
  'Context Menu', 'Status Bar', 'Sidebar', 'Column Groups', 'Keyboard Nav',
  'Formula Engine', 'Cell References', 'Sort', 'Pagination', 'Grid API',
];

function FeatureTicker() {
  const items = [...tickerFeatures, ...tickerFeatures];
  return (
    <div className={styles.ticker} aria-hidden="true">
      <div className={styles.tickerTrack}>
        {items.map((f, i) => (
          <span key={i} className={styles.tickerItem}>
            <span className={styles.tickerDot} />
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Rotating Install Command
   ────────────────────────────────────────────── */

const installCommands = [
  { pkg: '@alaarab/ogrid-react-radix', label: 'React + Radix' },
  { pkg: '@alaarab/ogrid-react-fluent', label: 'React + Fluent UI' },
];

function RotatingInstallCommand() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % installCommands.length);
        setVisible(true);
      }, 200);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.heroInstall}>
      <span className={styles.heroInstallPrompt}>$</span>
      <span className={styles.heroInstallText} style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.2s' }}>
        npm i {installCommands[index].pkg}
      </span>
      <span className={styles.heroInstallBadge} style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.2s' }}>
        {installCommands[index].label}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Hero
   ────────────────────────────────────────────── */

function SpreadsheetBackground() {
  const shimmerCells = useMemo(() => {
    const cells: Array<{ col: number; row: number; delay: number; duration: number; type: 'shimmer' | 'select' | 'data' }> = [];
    for (let i = 0; i < 18; i++) {
      cells.push({ col: ((i * 7 + 3) % 20), row: ((i * 13 + 5) % 14), delay: (i * 0.8) % 6, duration: 2.5 + (i % 3) * 0.7, type: 'shimmer' });
    }
    for (let r = 3; r <= 6; r++) {
      for (let c = 4; c <= 7; c++) {
        cells.push({ col: c, row: r, delay: 0, duration: 4, type: 'select' });
      }
    }
    for (let i = 0; i < 8; i++) {
      cells.push({ col: 12, row: i + 2, delay: i * 0.3, duration: 3, type: 'data' });
    }
    return cells;
  }, []);

  return (
    <div className={styles.spreadsheetBg} aria-hidden="true">
      <div className={styles.gridLines}>
        {Array.from({ length: 22 }).map((_, i) => (
          <div key={`v${i}`} className={styles.gridLineV} style={{ left: `${(i + 1) * 4.76}%` }} />
        ))}
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={`h${i}`} className={styles.gridLineH} style={{ top: `${(i + 1) * 6.25}%` }} />
        ))}
      </div>
      {shimmerCells.map((cell, i) => (
        <div
          key={i}
          className={`${styles.gridCell} ${styles[`gridCell--${cell.type}`]}`}
          style={{ left: `${cell.col * 4.76}%`, top: `${cell.row * 6.25}%`, animationDelay: `${cell.delay}s`, animationDuration: `${cell.duration}s` }}
        />
      ))}
    </div>
  );
}

function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (!glowRef.current || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    glowRef.current.style.setProperty('--glow-x', `${e.clientX - rect.left}px`);
    glowRef.current.style.setProperty('--glow-y', `${e.clientY - rect.top}px`);
    glowRef.current.style.opacity = '1';
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (glowRef.current) glowRef.current.style.opacity = '0';
  }, []);

  return (
    <section className={styles.hero} ref={heroRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <SpreadsheetBackground />
      <div className={styles.heroBg} />
      <div className={styles.heroGlow} ref={glowRef} />
      <div className={styles.heroVignette} />

      <div className={styles.heroInner}>
        <div className={styles.heroLeft}>
          <div className={styles.heroPill}>
            <span className={styles.heroPillDot} />
            MIT License · Free Forever
          </div>

          <h1 className={styles.heroHeadline}>
            The open-source<br />
            <em className={styles.heroHeadlineEm}>data grid.</em>
          </h1>

          <p className={styles.heroLead}>
            Sorting, filtering, editing, formulas, clipboard, virtual scroll.
            For React. MIT licensed.
          </p>

          <div className={styles.heroCta}>
            <Link className={styles.btnPrimary} to="/docs/getting-started/overview">
              <span>Get started</span>
              <span className={styles.btnArrow}>&rarr;</span>
            </Link>
            <Link className={styles.btnGhost} href="https://github.com/alaarab/ogrid">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
              <span>GitHub</span>
            </Link>
          </div>

          <RotatingInstallCommand />

        </div>

        <div className={styles.heroRight}>
          <div className={styles.heroGridGlow} />
          <BrowserOnly fallback={<div className={styles.heroGridPlaceholder} />}>
            {() => <HeroGrid />}
          </BrowserOnly>
        </div>
      </div>

      <FeatureTicker />
    </section>
  );
}

/* ──────────────────────────────────────────────
   Scroll Reveal Hook
   ────────────────────────────────────────────── */

function useScrollReveal<T extends HTMLElement = HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ──────────────────────────────────────────────
   Noise Texture SVG Overlay
   ────────────────────────────────────────────── */

let noiseId = 0;
function NoiseOverlay({ opacity = 0.03 }: { opacity?: number }) {
  const id = useMemo(() => `noise-${++noiseId}`, []);
  return (
    <svg className={styles.noiseOverlay} style={{ opacity }} aria-hidden="true">
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

/* ──────────────────────────────────────────────
   Code Preview (Framework Tabs)
   ────────────────────────────────────────────── */

const frameworks = [
  { id: 'radix', label: 'Radix' },
  { id: 'fluent', label: 'Fluent UI' },
] as const;

function getCodeExample(fw: typeof frameworks[number]) {
  const importLine =
    fw.id === 'radix'
      ? "import { OGrid } from '@alaarab/ogrid-react-radix';"
      : "import { OGrid } from '@alaarab/ogrid-react-fluent';";

  return `${importLine}

const columns = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'role', name: 'Role', filterable: { type: 'multiSelect' } },
  { columnId: 'salary', name: 'Salary', editable: true,
    valueFormatter: (v) => \`$\${v.toLocaleString()}\` },
];

function App() {
  return (
    <OGrid
      columns={columns}
      data={employees}
      getRowId={(e) => e.id}
      editable
      cellSelection
      statusBar
    />
  );
}`;
}

function CodePreviewSection() {
  const [active, setActive] = useState(0);
  const { ref, visible } = useScrollReveal<HTMLElement>(0.1);

  return (
    <section ref={ref} className={`${styles.codeSection} ${visible ? styles.revealed : ''}`}>
      <NoiseOverlay opacity={0.025} />
        <div className={styles.codeSectionInner}>
          <div className={styles.codeSectionLabel}>One API. Two React UI flavors.</div>
          <h2 className={styles.codeSectionTitle}>
          One grid model.<br />Pick your design system.<br />One-line import to switch.
          </h2>
          <p className={styles.codeSectionSub}>
          Radix and Fluent UI packages share the same hooks, props, and grid concepts.
          </p>
        </div>

      <div className={styles.codeWindowFloat}>
        <div className={styles.codeWindow}>
          <div className={styles.codeWindowChrome}>
            <span className={styles.chromeDot} />
            <span className={styles.chromeDot} />
            <span className={styles.chromeDot} />
            <div className={styles.codeWindowTabs}>
              {frameworks.map((fw, i) => (
                <button
                  key={fw.id}
                  className={`${styles.codeWindowTab} ${i === active ? styles.codeWindowTabActive : ''}`}
                  onClick={() => setActive(i)}
                >
                  {fw.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.codeWindowBody}>
            <CodeBlock language="tsx">
              {getCodeExample(frameworks[active])}
            </CodeBlock>
          </div>
        </div>
        {/* Reflection */}
        <div className={styles.codeReflection} aria-hidden="true" />
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   Feature Bento
   ────────────────────────────────────────────── */

function FeatureBentoSection() {
  const { ref, visible } = useScrollReveal<HTMLElement>(0.08);

  return (
    <section ref={ref} className={`${styles.bentoSection} ${visible ? styles.revealed : ''}`}>
      <div className={styles.bentoMesh} />
      <NoiseOverlay opacity={0.035} />
      <div className={styles.bentoHeader}>
        <div className={styles.bentoLabel}>Why OGrid</div>
        <h2 className={styles.bentoTitle}>
          Spreadsheet-grade interaction.<br />Open-source by default.
        </h2>
        <p className={styles.bentoSub}>
          The point is not a longer feature checklist. The point is getting the spreadsheet behavior
          and editing workflow you actually need, in a React grid, without a locked enterprise tier.
        </p>
      </div>

      <div className={styles.bentoGrid}>
        <div className={`${styles.bentoCard} ${styles.bentoCardWide} ${styles.bentoCardGreen} ${styles.bentoCardProof}`}>
          <div className={styles.bentoCardInner} />
          <div className={styles.bentoCardTag}>No gated tier</div>
          <h3 className={styles.bentoCardTitle}>MIT license. Real spreadsheet features.</h3>
          <p className={styles.bentoCardDesc}>
            Range selection, fill handle, clipboard, undo/redo, formulas, filters, pinning, and virtualization
            ship in the public packages. No split between “community” and “actually usable.”
          </p>
          <div className={styles.bentoFeatureList}>
            {[
              'Cell-range selection',
              'Fill handle',
              'Clipboard + multi-cell paste',
              'Undo / redo',
              'Formula bar + references',
              'Virtualized rows and columns',
            ].map((item) => (
              <span key={item} className={styles.bentoFeaturePill}>{item}</span>
            ))}
          </div>
        </div>

        <div className={`${styles.bentoCard} ${styles.bentoCardMedium} ${styles.bentoCardBlue} ${styles.bentoCardProof}`}>
          <div className={styles.bentoCardInner} />
          <div className={styles.bentoCardTag}>One API, two React UI kits</div>
          <h3 className={styles.bentoCardTitle}>One mental model. Pick your design system.</h3>
          <p className={styles.bentoCardDesc}>
            Both React packages share the same hooks, props, and grid concepts.
            Switch design systems with a one-line import change.
          </p>
          <div className={styles.bentoFrameworkBands}>
            <div className={styles.bentoFrameworkBand}>
              <span>Radix</span>
              <span>Lightweight default</span>
            </div>
            <div className={styles.bentoFrameworkBand}>
              <span>Fluent UI</span>
              <span>Microsoft 365 / SPFx</span>
            </div>
          </div>
        </div>

        <div className={`${styles.bentoCard} ${styles.bentoCardMedium} ${styles.bentoCardDark} ${styles.bentoCardProof}`}>
          <div className={styles.bentoCardInner} />
          <div className={styles.bentoCardTag}>Editing workflow</div>
          <h3 className={styles.bentoCardTitle}>Built for people who live in grids.</h3>
          <p className={styles.bentoCardDesc}>
            Keyboard navigation, inline editing, bulk paste, formulas, and status-bar feedback
            are part of the normal flow, not bolted on demos.
          </p>
          <div className={styles.bentoCommandGrid}>
            {['Enter edit', 'Tab move', 'Shift+Click range', 'Ctrl+C / Ctrl+V'].map((item) => (
              <div key={item} className={styles.bentoCommandCard}>{item}</div>
            ))}
          </div>
        </div>

        <div className={`${styles.bentoCard} ${styles.bentoCardSmall} ${styles.bentoCardPurple} ${styles.bentoCardProof}`}>
          <div className={styles.bentoCardInner} />
          <div className={styles.bentoCardTag}>Performance</div>
          <h3 className={styles.bentoCardTitle}>10K+ rows in the homepage demo.</h3>
          <p className={styles.bentoCardDesc}>
            The examples are not toy screenshots. The docs are running a real grid with real interaction state.
          </p>
          <div className={styles.bentoMetricRow}>
            <div>
              <strong>10,000</strong>
              <span>rows</span>
            </div>
            <div>
              <strong>100</strong>
              <span>page size</span>
            </div>
            <div>
              <strong>MIT</strong>
              <span>license</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   Live Data
   ────────────────────────────────────────────── */

function LiveDataSection() {
  const { ref, visible } = useScrollReveal<HTMLElement>(0.08);

  return (
    <section ref={ref} className={`${styles.liveDataSection} ${visible ? styles.revealed : ''}`}>
      <div className={styles.liveDataInner}>
        <div className={styles.liveDataHeader}>
          <div className={styles.liveDataLabel}>Real-time</div>
          <h2 className={styles.liveDataTitle}>
            Live updates without the jank.
          </h2>
          <p className={styles.liveDataSub}>
            Trading terminals, monitoring dashboards, and operational tables need constant updates.
            OGrid keeps the grid responsive while the data keeps moving.
          </p>
        </div>
        <BrowserOnly fallback={<div style={{ height: 500 }} />}>
          {() => {
            const LiveDataDemo = require('../components/LiveDataDemo').default;
            return <LiveDataDemo />;
          }}
        </BrowserOnly>
      </div>
    </section>
  );
}


/* ──────────────────────────────────────────────
   CTA
   ────────────────────────────────────────────── */

interface FrameworkCard {
  name: string;
  uiKits: Array<{ label: string; pkg: string }>;
}

const frameworkCards: FrameworkCard[] = [
  {
    name: 'Radix',
    uiKits: [
      { label: 'Lightweight default', pkg: '@alaarab/ogrid-react-radix' },
    ],
  },
  {
    name: 'Fluent UI',
    uiKits: [
      { label: 'Microsoft 365 / SPFx', pkg: '@alaarab/ogrid-react-fluent' },
    ],
  },
];

function CTASection() {
  const { ref, visible } = useScrollReveal<HTMLElement>(0.1);
  const [selectedFramework, setSelectedFramework] = useState(0);
  const [selectedUiKit, setSelectedUiKit] = useState(0);

  const activeFramework = frameworkCards[selectedFramework];
  const activeUiKit = activeFramework.uiKits[Math.min(selectedUiKit, activeFramework.uiKits.length - 1)];

  const handleFrameworkClick = useCallback((i: number) => {
    setSelectedFramework(i);
    setSelectedUiKit(0);
  }, []);

  return (
    <section ref={ref} className={`${styles.ctaSection} ${visible ? styles.revealed : ''}`}>
      <div className={styles.ctaBg} />
      <div className={styles.ctaVignette} />
      <div className={styles.ctaInner}>
        <h2 className={styles.ctaTitle}>
          Pick your stack.<br />
          <span className={styles.ctaTitleGlow}>Ship in minutes.</span>
        </h2>
        <p className={styles.ctaSub}>
          Every package has the same API. Drop it in, configure columns, done.
        </p>

        <div className={styles.ctaFrameworks}>
          {frameworkCards.map((fw, i) => (
            <button
              key={fw.name}
              className={`${styles.ctaFrameworkCard} ${i === selectedFramework ? styles.ctaFrameworkCardActive : ''}`}
              style={{ transitionDelay: visible ? `${200 + i * 80}ms` : '0ms' }}
              onClick={() => handleFrameworkClick(i)}
              type="button"
            >
              <div className={styles.ctaFrameworkName}>{fw.name}</div>
              <div className={styles.ctaFrameworkDetail}>{fw.uiKits.map(k => k.label).join(' · ')}</div>
              <div className={styles.ctaFrameworkCount}>{fw.uiKits.length === 1 ? '1 package' : `${fw.uiKits.length} UI kits`}</div>
            </button>
          ))}
        </div>

        {activeFramework.uiKits.length > 1 && (
          <div className={styles.ctaUiKitPicker}>
            {activeFramework.uiKits.map((kit, i) => (
              <button
                key={kit.pkg}
                className={`${styles.ctaUiKitBtn} ${i === selectedUiKit ? styles.ctaUiKitBtnActive : ''}`}
                onClick={() => setSelectedUiKit(i)}
                type="button"
              >
                {kit.label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.ctaInstallPulse}>
          <div className={styles.heroInstall}>
            <span className={styles.heroInstallPrompt}>$</span>
            <span className={styles.heroInstallText}>
              npm i {activeUiKit.pkg}
            </span>
          </div>
        </div>

        <div className={styles.ctaActions}>
          <Link className={`${styles.btnPrimary} ${styles.btnPrimaryGlow}`} to="/docs/getting-started/overview">
            Read the docs
          </Link>
          <Link className={styles.btnGhost} href="https://github.com/alaarab/ogrid">
            GitHub
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   Page
   ────────────────────────────────────────────── */

export default function Home() {
  return (
    <Layout
      title="The open-source React data grid. Spreadsheet-grade. Zero compromises."
      description="Free open-source React data grid (Radix and Fluent UI). Sorting, filtering, editing, spreadsheet selection, clipboard, fill handle, formulas, and more. MIT licensed with no enterprise tier."
    >
      <Hero />
      <CodePreviewSection />
      <LiveDataSection />
      <CTASection />
    </Layout>
  );
}
