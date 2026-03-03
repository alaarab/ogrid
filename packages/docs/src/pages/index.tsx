import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  // Duplicate for seamless loop
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

function Hero() {
  return (
    <section className={styles.hero}>
      {/* Background layers */}
      <div className={styles.heroBg} />
      <div className={styles.heroGrid} />

      <div className={styles.heroInner}>
        {/* Left column: editorial text */}
        <div className={styles.heroLeft}>
          <div className={styles.heroPill}>
            <span className={styles.heroPillDot} />
            MIT License &mdash; Free Forever
          </div>

          <h1 className={styles.heroHeadline}>
            The data grid<br />
            <em className={styles.heroHeadlineEm}>developers</em><br />
            actually want.
          </h1>

          <p className={styles.heroLead}>
            React, Angular, Vue, or Vanilla JS.
            Sorting, filtering, editing, spreadsheet
            selection, clipboard, formulas — all free.
            No enterprise tier.
          </p>

          <div className={styles.heroCta}>
            <Link className={styles.btnPrimary} to="/docs/getting-started/overview">
              Get started free
            </Link>
            <Link className={styles.btnGhost} href="https://github.com/alaarab/ogrid">
              View on GitHub
            </Link>
          </div>

          <RotatingInstallCommand />

          {/* Stat strip */}
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>10</span>
              <span className={styles.heroStatLabel}>Frameworks & UI kits</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>25+</span>
              <span className={styles.heroStatLabel}>Built-in features</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>$0</span>
              <span className={styles.heroStatLabel}>Enterprise cost</span>
            </div>
          </div>
        </div>

        {/* Right column: live grid */}
        <div className={styles.heroRight}>
          <BrowserOnly fallback={<div className={styles.heroGridPlaceholder} />}>
            {() => <HeroGrid />}
          </BrowserOnly>
        </div>
      </div>

      {/* Feature ticker below hero */}
      <FeatureTicker />
    </section>
  );
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

  return (
    <section className={styles.codeSection}>
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
    </section>
  );
}

/* ──────────────────────────────────────────────
   Feature Bento
   ────────────────────────────────────────────── */

function FeatureBentoSection() {
  return (
    <section className={styles.bentoSection}>
      <div className={styles.bentoHeader}>
        <div className={styles.bentoLabel}>Features</div>
        <h2 className={styles.bentoTitle}>
          Enterprise features.<br />MIT license.
        </h2>
        <p className={styles.bentoSub}>
          25+ features shipped. Zero paywalls.
          Everything you'd pay $999/dev for elsewhere — built in.
        </p>
      </div>

      <div className={styles.bentoGrid}>
        {/* Large card: Spreadsheet Selection */}
        <div className={`${styles.bentoCard} ${styles.bentoCardWide} ${styles.bentoCardGreen}`}>
          <div className={styles.bentoCardTag}>Core differentiator</div>
          <h3 className={styles.bentoCardTitle}>Spreadsheet Selection</h3>
          <p className={styles.bentoCardDesc}>
            Click-and-drag cell ranges, active cell highlight, multi-cell clipboard.
            This is an $999/dev enterprise feature in AG Grid. It's built in here.
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
          <div className={styles.bentoCardTag}>Performance</div>
          <h3 className={styles.bentoCardTitle}>Virtual Scrolling</h3>
          <p className={styles.bentoCardDesc}>10,000+ rows with web worker sort.</p>
          <div className={styles.bentoStatBig}>10K+</div>
        </div>

        {/* Small card: Frameworks */}
        <div className={`${styles.bentoCard} ${styles.bentoCardSmall} ${styles.bentoCardBlue}`}>
          <div className={styles.bentoCardTag}>Cross-framework</div>
          <h3 className={styles.bentoCardTitle}>10 packages</h3>
          <p className={styles.bentoCardDesc}>React · Angular · Vue · Vanilla JS</p>
          <div className={styles.bentoFrameworkDots}>
            {['R', 'A', 'V', 'JS'].map(f => <span key={f} className={styles.bentoFrameworkDot}>{f}</span>)}
          </div>
        </div>

        {/* Medium card: Undo/Redo + Clipboard */}
        <div className={`${styles.bentoCard} ${styles.bentoCardMedium}`}>
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
   Comparison — horizontal price cliff
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
  return (
    <section className={styles.compSection}>
      <div className={styles.compInner}>
        <div className={styles.compHeader}>
          <div className={styles.compLabel}>Comparison</div>
          <h2 className={styles.compTitle}>
            Why pay $999/dev<br />for features that should be free?
          </h2>
          <p className={styles.compSub}>
            AG Grid charges enterprise rates for spreadsheet-grade UX.
            OGrid ships all of it — free, forever.
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
              <div key={row.name} className={`${styles.compRow} ${i % 2 === 0 ? styles.compRowEven : ''}`}>
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
  return (
    <section className={styles.ctaSection}>
      <div className={styles.ctaBg} />
      <div className={styles.ctaInner}>
        <h2 className={styles.ctaTitle}>
          Pick your stack.<br />Ship in minutes.
        </h2>
        <p className={styles.ctaSub}>
          Every package has the same API. Drop it in, configure columns, done.
        </p>

        <div className={styles.ctaFrameworks}>
          {frameworkCards.map((fw) => (
            <div key={fw.name} className={styles.ctaFrameworkCard}>
              <div className={styles.ctaFrameworkName}>{fw.name}</div>
              <div className={styles.ctaFrameworkDetail}>{fw.detail}</div>
              <div className={styles.ctaFrameworkCount}>{fw.count}</div>
            </div>
          ))}
        </div>

        <RotatingInstallCommand />

        <div className={styles.ctaActions}>
          <Link className={styles.btnPrimary} to="/docs/getting-started/overview">
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
      title="The data grid developers actually want."
      description="Lightweight data grid for React, Angular, Vue, and vanilla JS. Sorting, filtering, editing, spreadsheet selection, clipboard, formulas — all free. No enterprise tier."
    >
      <Hero />
      <CodePreviewSection />
      <FeatureBentoSection />
      <ComparisonSection />
      <CTASection />
    </Layout>
  );
}
