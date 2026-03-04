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
    { columnId: 'id', name: '#', type: 'numeric' as const, defaultWidth: 50 },
    { columnId: 'name', name: 'Name', sortable: true, editable: true, defaultWidth: 170 },
    { columnId: 'department', name: 'Department', sortable: true, editable: true, filterable: { type: 'multiSelect' as const }, cellEditor: 'richSelect' as const, cellEditorParams: { values: DEPARTMENTS }, defaultWidth: 145 },
    { columnId: 'title', name: 'Title', sortable: true, editable: true, filterable: { type: 'text' as const }, defaultWidth: 180 },
    { columnId: 'email', name: 'Email', editable: true, defaultWidth: 200 },
    { columnId: 'salary', name: 'Salary', type: 'numeric' as const, editable: true, valueFormatter: (v: unknown) => v != null ? `$${Number(v).toLocaleString()}` : '', defaultWidth: 110 },
    { columnId: 'startDate', name: 'Start Date', type: 'date' as const, sortable: true, editable: true, defaultWidth: 130 },
    { columnId: 'remote', name: 'Remote', type: 'boolean' as const, editable: true, sortable: true, filterable: { type: 'multiSelect' as const }, defaultWidth: 90 },
    { columnId: 'status', name: 'Status', editable: true, filterable: { type: 'multiSelect' as const }, cellEditor: 'richSelect' as const, cellEditorParams: { values: STATUSES_UNIQUE }, defaultWidth: 110 },
    { columnId: 'rating', name: 'Rating', sortable: true, editable: true, filterable: { type: 'multiSelect' as const }, cellEditor: RatingEditor, cellEditorPopup: true, cellEditorParams: { maxStars: 5 }, defaultWidth: 90 },
    { columnId: 'color', name: 'Color', editable: true, cellEditor: ColorPickerEditor, cellEditorPopup: true, defaultWidth: 80, valueFormatter: (v: unknown) => v ? String(v) : '' },
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
              background: density === opt.value ? 'var(--ogrid-selection, #217346)' : 'transparent',
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
          { col: 5, row: 4, formula: '=SUM(F1:F4)' },
          { col: 5, row: 5, formula: '=AVERAGE(F1:F4)' },
          { col: 5, row: 6, formula: '=MAX(F1:F4)' },
          { col: 5, row: 7, formula: '=MIN(F1:F4)' },
          { col: 9, row: 4, formula: '=AVERAGE(J1:J4)' },
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
  { pkg: '@alaarab/ogrid-react-material', label: 'React + Material UI' },
  { pkg: '@alaarab/ogrid-angular-material', label: 'Angular + Material' },
  { pkg: '@alaarab/ogrid-angular-primeng', label: 'Angular + PrimeNG' },
  { pkg: '@alaarab/ogrid-angular-radix', label: 'Angular + Radix' },
  { pkg: '@alaarab/ogrid-vue-vuetify', label: 'Vue + Vuetify' },
  { pkg: '@alaarab/ogrid-vue-primevue', label: 'Vue + PrimeVue' },
  { pkg: '@alaarab/ogrid-vue-radix', label: 'Vue + Radix' },
  { pkg: '@alaarab/ogrid-js', label: 'Vanilla JS' },
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
            The data grid<br />
            <em className={styles.heroHeadlineEm}>AG Grid charges for.</em>
          </h1>

          <p className={styles.heroLead}>
            Sorting, filtering, editing, formulas, clipboard, virtual scroll.
            React, Angular, Vue, Vanilla JS. MIT licensed.
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
   Matrix Rain Canvas (CTA background)
   ────────────────────────────────────────────── */

const MATRIX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const fontSize = 14;
    let columns: number;
    let drops: number[];

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.floor(canvas.offsetWidth / fontSize);
      drops = Array(columns).fill(0).map(() => Math.random() * -50);
    }

    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx!.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx!.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      ctx!.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns; i++) {
        const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        const alpha = 0.06 + Math.random() * 0.1;
        ctx!.fillStyle = `rgba(58, 184, 118, ${alpha})`;
        ctx!.fillText(char, x, y);

        if (Math.random() > 0.975) {
          ctx!.fillStyle = 'rgba(78, 196, 132, 0.45)';
          ctx!.fillText(char, x, y);
        }

        if (y > canvas.offsetHeight && Math.random() > 0.985) {
          drops[i] = 0;
        }
        drops[i] += 0.35 + Math.random() * 0.25;
      }
      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.matrixCanvas} />;
}

/* ──────────────────────────────────────────────
   Code Preview (Framework Tabs)
   ────────────────────────────────────────────── */

const frameworks = [
  { id: 'react', label: 'React' },
  { id: 'angular', label: 'Angular' },
  { id: 'vue', label: 'Vue' },
  { id: 'js', label: 'Vanilla JS' },
] as const;

function getCodeExample(fw: typeof frameworks[number]) {
  switch (fw.id) {
    case 'react':
      return `import { OGrid } from '@alaarab/ogrid-react-radix';
// Also: '@alaarab/ogrid-react-fluent' | '@alaarab/ogrid-react-material'

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
    case 'angular':
      return `import { OGridComponent } from '@alaarab/ogrid-angular-material';
// Also: '@alaarab/ogrid-angular-primeng' | '@alaarab/ogrid-angular-radix'

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`
    <ogrid
      [columns]="columns" [data]="employees"
      [getRowId]="getRowId" [editable]="true"
      [cellSelection]="true" [statusBar]="true"
    />
  \`,
})
export class AppComponent {
  columns = [
    { columnId: 'name', name: 'Name', sortable: true },
    { columnId: 'role', name: 'Role', filterable: { type: 'multiSelect' } },
    { columnId: 'salary', name: 'Salary', editable: true,
      valueFormatter: (v) => \`$\${v.toLocaleString()}\` },
  ];
  getRowId = (e) => e.id;
}`;
    case 'vue':
      return `<script setup lang="ts">
import { OGrid } from '@alaarab/ogrid-vue-vuetify';
// Also: '@alaarab/ogrid-vue-primevue' | '@alaarab/ogrid-vue-radix'

const columns = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'role', name: 'Role', filterable: { type: 'multiSelect' } },
  { columnId: 'salary', name: 'Salary', editable: true,
    valueFormatter: (v) => \`$\${v.toLocaleString()}\` },
];
</script>

<template>
  <OGrid :columns="columns" :data="employees"
    :getRowId="(e) => e.id" editable cellSelection statusBar />
</template>`;
    case 'js':
      return `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';

const grid = new OGrid(document.getElementById('grid'), {
  columns: [
    { columnId: 'name', name: 'Name', sortable: true },
    { columnId: 'role', name: 'Role', filterable: { type: 'multiSelect' } },
    { columnId: 'salary', name: 'Salary', editable: true,
      valueFormatter: (v) => \`$\${v.toLocaleString()}\` },
  ],
  data: employees,
  getRowId: (e) => e.id,
  editable: true,
  cellSelection: true,
  statusBar: true,
});`;
  }
}

function CodePreviewSection() {
  const [active, setActive] = useState(0);
  const { ref, visible } = useScrollReveal<HTMLElement>(0.1);

  return (
    <section ref={ref} className={`${styles.codeSection} ${visible ? styles.revealed : ''}`}>
      <NoiseOverlay opacity={0.025} />
      <div className={styles.codeSectionInner}>
        <div className={styles.codeSectionLabel}>One API. Four frameworks.</div>
        <h2 className={styles.codeSectionTitle}>
          Same props.<br />Same behavior.<br />Just swap the import.
        </h2>
        <p className={styles.codeSectionSub}>
          10 packages across React, Angular, Vue, and Vanilla JS.
          All share an identical column definition and prop API.
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
            <CodeBlock language={frameworks[active].id === 'vue' ? 'html' : frameworks[active].id === 'react' ? 'tsx' : 'typescript'}>
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
        <div className={styles.bentoLabel}>Features</div>
        <h2 className={styles.bentoTitle}>
          Enterprise features.<br />MIT license.
        </h2>
        <p className={styles.bentoSub}>
          25+ features shipped. Zero paywalls.
          Everything you'd pay $999/dev for elsewhere - built in.
        </p>
      </div>

      <div className={styles.bentoGrid}>
        {/* Large card: Spreadsheet Selection */}
        <div className={`${styles.bentoCard} ${styles.bentoCardWide} ${styles.bentoCardGreen}`}>
          <div className={styles.bentoCardInner} />
          <div className={styles.bentoCardTag}>Core differentiator</div>
          <h3 className={styles.bentoCardTitle}>Spreadsheet Selection</h3>
          <p className={styles.bentoCardDesc}>
            Click-and-drag cell ranges, active cell highlight, multi-cell clipboard.
            AG Grid charges $999/dev for this. Here it ships by default.
          </p>
          <div className={styles.bentoCardIllustration}>
            <div className={styles.bentoSelectionGrid}>
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className={`${styles.bentoSelCell} ${i >= 6 && i <= 13 && i !== 10 && i !== 11 ? styles.bentoSelCellActive : ''} ${i === 8 ? styles.bentoSelCellFocused : ''}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Tall card: Fill Handle */}
        <div className={`${styles.bentoCard} ${styles.bentoCardTall} ${styles.bentoCardDark}`}>
          <div className={styles.bentoCardInner} />
          <div className={styles.bentoCardTag}>Excel-style</div>
          <h3 className={styles.bentoCardTitle}>Fill Handle</h3>
          <p className={styles.bentoCardDesc}>
            Drag the corner to fill values down entire columns.
          </p>
          <div className={styles.bentoFillIllustration}>
            {['$42,000', '$43,000', '$44,000', '...'].map((v, i) => (
              <div key={i} className={`${styles.bentoFillRow} ${i === 3 ? styles.bentoFillRowGhost : ''}`}>{v}</div>
            ))}
            <div className={styles.bentoFillHandle} />
          </div>
        </div>

        {/* Small card: Virtual Scrolling */}
        <div className={`${styles.bentoCard} ${styles.bentoCardSmall}`}>
          <div className={styles.bentoCardInner} />
          <div className={styles.bentoCardTag}>Performance</div>
          <h3 className={styles.bentoCardTitle}>Virtual Scrolling</h3>
          <p className={styles.bentoCardDesc}>10,000+ rows with web worker sort.</p>
          <div className={styles.bentoStatBig}>10K+</div>
        </div>

        {/* Small card: Frameworks */}
        <div className={`${styles.bentoCard} ${styles.bentoCardSmall} ${styles.bentoCardBlue}`}>
          <div className={styles.bentoCardInner} />
          <div className={styles.bentoCardTag}>Cross-framework</div>
          <h3 className={styles.bentoCardTitle}>10 packages</h3>
          <p className={styles.bentoCardDesc}>React · Angular · Vue · Vanilla JS</p>
          <div className={styles.bentoFrameworkDots}>
            {['R', 'A', 'V', 'JS'].map(f => <span key={f} className={styles.bentoFrameworkDot}>{f}</span>)}
          </div>
        </div>

        {/* Medium card: Undo/Redo + Clipboard */}
        <div className={`${styles.bentoCard} ${styles.bentoCardMedium}`}>
          <div className={styles.bentoCardInner} />
          <div className={styles.bentoCardTag}>Productivity</div>
          <h3 className={styles.bentoCardTitle}>Full edit history</h3>
          <p className={styles.bentoCardDesc}>
            Ctrl+Z / Ctrl+Y undo stack. Ctrl+C/V/X clipboard with multi-cell paste.
          </p>
          <div className={styles.bentoKbdRow}>
            {['Ctrl+Z', 'Ctrl+Y', 'Ctrl+C', 'Ctrl+V'].map(k => (
              <kbd key={k} className={styles.bentoKbd}>{k}</kbd>
            ))}
          </div>
        </div>

        {/* Medium card: Formula Engine */}
        <div className={`${styles.bentoCard} ${styles.bentoCardMedium} ${styles.bentoCardPurple}`}>
          <div className={styles.bentoCardInner} />
          <div className={styles.bentoCardTag}>Built-in</div>
          <h3 className={styles.bentoCardTitle}>Formula Engine</h3>
          <p className={styles.bentoCardDesc}>
            93 functions. SUM, IF, VLOOKUP, and more. Excel-style cell references.
          </p>
          <div className={styles.bentoFormulaBar}>
            <span className={styles.bentoFx}>fx</span>
            <span className={styles.bentoFormula}>=SUM(B2:B1000)</span>
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
            Built for live data.
          </h2>
          <p className={styles.liveDataSub}>
            Financial dashboards, trading terminals, monitoring systems.
            OGrid handles high-frequency updates without skipping a frame.
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
   Comparison - horizontal price cliff
   ────────────────────────────────────────────── */

const comparisonRows = [
  { name: 'Sorting & Filtering', ogrid: true, aggrid: 'free' as const },
  { name: 'Cell Editing', ogrid: true, aggrid: 'free' as const },
  { name: 'CSV Export', ogrid: true, aggrid: 'free' as const },
  { name: 'Keyboard Navigation', ogrid: true, aggrid: 'free' as const },
  { name: 'Spreadsheet Selection', ogrid: true, aggrid: 'paid' as const },
  { name: 'Clipboard Copy/Paste', ogrid: true, aggrid: 'paid' as const },
  { name: 'Fill Handle', ogrid: true, aggrid: 'paid' as const },
  { name: 'Undo / Redo', ogrid: true, aggrid: 'paid' as const },
  { name: 'Context Menu', ogrid: true, aggrid: 'paid' as const },
  { name: 'Status Bar', ogrid: true, aggrid: 'paid' as const },
  { name: 'Side Bar', ogrid: true, aggrid: 'paid' as const },
  { name: 'Server-Side Data', ogrid: true, aggrid: 'paid' as const },
  { name: 'Formula Engine', ogrid: true, aggrid: 'paid' as const },
  { name: 'Headless Core', ogrid: true, aggrid: 'no' as const },
  { name: 'License', ogrid: true, aggrid: 'neutral' as const },
  { name: 'Price', ogrid: true, aggrid: 'paid' as const },
];

function ComparisonSection() {
  const { ref, visible } = useScrollReveal<HTMLElement>(0.08);

  return (
    <section ref={ref} className={`${styles.compSection} ${visible ? styles.revealed : ''}`}>
      <NoiseOverlay opacity={0.02} />
      <div className={styles.compInner}>
        <div className={styles.compHeader}>
          <div className={styles.compLabel}>Comparison</div>
          <h2 className={styles.compTitle}>
            Why pay $999/dev<br />for features that should be free?
          </h2>
          <p className={styles.compSub}>
            AG Grid charges enterprise rates for spreadsheet-grade UX.
            OGrid ships all of it - free, forever.
          </p>
        </div>

        <div className={styles.compTable}>
          <div className={styles.compTableHead}>
            <div className={styles.compTableFeatureCol}>Feature</div>
            <div className={`${styles.compTableCol} ${styles.compTableColOGrid}`}>
              <span className={styles.compTableLogo}>OGrid</span>
              <span className={styles.compTablePrice}>$0 / forever</span>
            </div>
            <div className={styles.compTableCol}>
              <span className={styles.compTableLogo}>AG Grid</span>
              <span className={styles.compTablePricePaid}>from $999 / dev</span>
            </div>
          </div>

          <div className={styles.compTableBody}>
            {comparisonRows.map((row, i) => (
              <div
                key={row.name}
                className={`${styles.compRow} ${i % 2 === 0 ? styles.compRowEven : ''}`}
                style={{ transitionDelay: visible ? `${i * 40}ms` : '0ms' }}
              >
                <div className={styles.compRowFeature}>{row.name}</div>
                <div className={`${styles.compRowCell} ${styles.compRowCellOGrid}`}>
                  <span className={styles.compCheck}>✓</span>
                  <span className={styles.compCheckLabel}>Included</span>
                </div>
                <div className={styles.compRowCell}>
                  {row.aggrid === 'free' && (
                    <><span className={styles.compCheck}>✓</span><span className={styles.compCheckLabel}>Community</span></>
                  )}
                  {row.aggrid === 'paid' && (
                    <><span className={styles.compLock}>$</span><span className={styles.compLockLabel}>Enterprise only</span></>
                  )}
                  {row.aggrid === 'no' && (
                    <><span className={styles.compNo}>–</span><span className={styles.compNoLabel}>Not available</span></>
                  )}
                  {row.aggrid === 'neutral' && (
                    <span className={styles.compNeutral}>MIT / Commercial</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.compTableFoot}>
            <div className={styles.compTableFeatureCol} />
            <div className={`${styles.compFootCell} ${styles.compFootCellOGrid}`}>
              <span className={styles.compFootPrice}>$0</span>
              <Link className={styles.btnPrimary} to="/docs/getting-started/overview">
                Start building
              </Link>
            </div>
            <div className={styles.compFootCell}>
              <span className={styles.compFootPricePaid}>$999+/dev</span>
              <span className={styles.compFootNote}>per developer per year</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   CTA
   ────────────────────────────────────────────── */

const frameworkCards = [
  { name: 'React', detail: 'Radix · Fluent · Material', count: '3 UI kits' },
  { name: 'Angular', detail: 'Material · PrimeNG · Radix', count: '3 UI kits' },
  { name: 'Vue', detail: 'Vuetify · PrimeVue · Radix', count: '3 UI kits' },
  { name: 'Vanilla JS', detail: 'Zero dependencies', count: '1 package' },
];

function CTASection() {
  const { ref, visible } = useScrollReveal<HTMLElement>(0.1);

  return (
    <section ref={ref} className={`${styles.ctaSection} ${visible ? styles.revealed : ''}`}>
      <div className={styles.ctaBg} />
      <BrowserOnly fallback={null}>
        {() => <MatrixRain />}
      </BrowserOnly>
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
            <div
              key={fw.name}
              className={styles.ctaFrameworkCard}
              style={{ transitionDelay: visible ? `${200 + i * 80}ms` : '0ms' }}
            >
              <div className={styles.ctaFrameworkName}>{fw.name}</div>
              <div className={styles.ctaFrameworkDetail}>{fw.detail}</div>
              <div className={styles.ctaFrameworkCount}>{fw.count}</div>
            </div>
          ))}
        </div>

        <div className={styles.ctaInstallPulse}>
          <RotatingInstallCommand />
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
      title="Your spreadsheet. Your framework. Zero compromises."
      description="Lightweight data grid for React, Angular, Vue, and vanilla JS. Sorting, filtering, editing, spreadsheet selection, clipboard, formulas - all free. No enterprise tier."
    >
      <Hero />
      <CodePreviewSection />
      <FeatureBentoSection />
      <LiveDataSection />
      <ComparisonSection />
      <CTASection />
    </Layout>
  );
}
