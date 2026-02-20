import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import Link from '@docusaurus/Link';
import styles from './index.module.scss';

/* ──────────────────────────────────────────────
   Hero Grid — Real OGrid with 10K rows
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
  rating: string;
  remote: boolean;
}

const FIRST_NAMES = ['James','Emma','Liam','Olivia','Noah','Ava','William','Sophia','Benjamin','Isabella','Lucas','Mia','Henry','Charlotte','Alexander','Amelia','Daniel','Harper','Matthew','Evelyn','Sebastian','Abigail','Jack','Emily','Aiden','Elizabeth','Owen','Sofia','Samuel','Avery','Ryan','Ella','Nathan','Scarlett','Leo','Grace','Isaac','Lily','Ethan','Chloe','Mason','Penelope','Logan','Layla','Jacob','Riley','Michael','Zoey','Elijah','Nora'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts'];
const DEPARTMENTS = ['Engineering','Product','Design','Marketing','Sales','Finance','HR','Legal','Operations','Support'];
const TITLES = ['Software Engineer','Product Manager','UX Designer','Data Analyst','Sales Executive','Account Manager','HR Specialist','Legal Counsel','DevOps Engineer','Support Lead','Frontend Developer','Backend Developer','QA Engineer','Scrum Master','Tech Lead','Marketing Manager','Content Strategist','BD Manager','Recruiter','Finance Analyst'];
const STATUSES: string[] = ['Active','Active','Active','Active','Active','Active','Active','Remote','Remote','On Leave'];
const RATINGS = ['A+','A','A','A-','B+','B+','B','B','A','A-'];
const STATUSES_UNIQUE = [...new Set(STATUSES)];
const RATINGS_UNIQUE = [...new Set(RATINGS)];

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
      rating: RATINGS[i % 10],
      remote: i % 5 === 0 || i % 7 === 0,
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
  type ApiType = import('@alaarab/ogrid-react-radix').IOGridApi<EmployeeRow>;
  type IFilters = import('@alaarab/ogrid-react-radix').IFilters;

  const apiRef = useRef<ApiType>(null);
  const data = useMemo(() => generateData(), []);
  const [filters, setFilters] = useState<IFilters>({});
  const [density, setDensity] = useState<'compact' | 'normal' | 'comfortable'>('normal');

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
    { columnId: 'rating', name: 'Rating', sortable: true, editable: true, filterable: { type: 'multiSelect' as const }, cellEditor: 'richSelect' as const, cellEditorParams: { values: RATINGS_UNIQUE }, defaultWidth: 90 },
  ], []);

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
        density={density}
        defaultPageSize={100}
        layoutMode="fill"
        entityLabelPlural="employees"
      />
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

const packagesByFramework = [
  {
    framework: 'React',
    packages: [
      { name: 'ogrid-react-radix', ui: 'Radix UI', default: true },
      { name: 'ogrid-react-fluent', ui: 'Fluent UI' },
      { name: 'ogrid-react-material', ui: 'Material UI' },
    ],
  },
  {
    framework: 'Angular',
    packages: [
      { name: 'ogrid-angular-material', ui: 'Material' },
      { name: 'ogrid-angular-primeng', ui: 'PrimeNG' },
      { name: 'ogrid-angular-radix', ui: 'Radix UI' },
    ],
  },
  {
    framework: 'Vue',
    packages: [
      { name: 'ogrid-vue-vuetify', ui: 'Vuetify' },
      { name: 'ogrid-vue-primevue', ui: 'PrimeVue' },
      { name: 'ogrid-vue-radix', ui: 'Radix UI' },
    ],
  },
  {
    framework: 'Vanilla',
    packages: [
      { name: 'ogrid-js', ui: 'No framework' },
    ],
  },
];

function PackagesGrid() {
  return (
    <div className={styles.packagesGrid}>
      {packagesByFramework.map((group) => (
        <div key={group.framework} className={styles.packageGroup}>
          <div className={styles.packageGroupTitle}>{group.framework}</div>
          {group.packages.map((pkg) => (
            <div key={pkg.name} className={styles.packageItem}>
              <code className={styles.packageName}>@alaarab/{pkg.name}</code>
              <span className={styles.packageUi}>
                {pkg.ui}
                {'default' in pkg && pkg.default && <span className={styles.packageDefault}>default</span>}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function RotatingInstallCommand() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % installCommands.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.heroInstall}>
      <span className={styles.heroInstallDollar}>$</span>
      <span className={styles.heroInstallCommand}>
        npm install {installCommands[index].pkg}
      </span>
      <span className={styles.heroInstallLabel}>
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
      <div className={styles.heroGradientMesh} />
      <div className={styles.heroContent}>
        <h1 className={styles.heroTitle}>
          Every Spreadsheet Feature.<br />Zero Enterprise Tax.
        </h1>
        <p className={styles.heroSubtitle}>
          A lightweight data grid for React, Angular, Vue, and vanilla JS with sorting,
          filtering, editing, selection, clipboard, and more. Free forever.
        </p>

        <BrowserOnly fallback={<div className={styles.heroGridPlaceholder} />}>
          {() => <HeroGrid />}
        </BrowserOnly>

        <div className={styles.heroButtons}>
          <Link className={styles.btnPrimary} to="/docs/getting-started/overview">
            Get Started
          </Link>
          <Link
            className={styles.btnGhost}
            href="https://github.com/alaarab/ogrid"
          >
            GitHub
          </Link>
        </div>
        <RotatingInstallCommand />
      </div>
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
// Also available: '@alaarab/ogrid-react-fluent'
//                 '@alaarab/ogrid-react-material'

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
// Also available: '@alaarab/ogrid-angular-primeng'

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`
    <ogrid
      [columns]="columns"
      [data]="employees"
      [getRowId]="getRowId"
      [editable]="true"
      [cellSelection]="true"
      [statusBar]="true"
    />
  \`,
})
export class AppComponent {
  columns = [
    { columnId: 'name', name: 'Name', sortable: true },
    { columnId: 'role', name: 'Role',
      filterable: { type: 'multiSelect' } },
    { columnId: 'salary', name: 'Salary', editable: true,
      valueFormatter: (v) => \`$\${v.toLocaleString()}\` },
  ];
  getRowId = (e) => e.id;
}`;
    case 'vue':
      return `<script setup lang="ts">
import { OGrid } from '@alaarab/ogrid-vue-vuetify';
// Also available: '@alaarab/ogrid-vue-primevue'

const columns = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'role', name: 'Role',
    filterable: { type: 'multiSelect' } },
  { columnId: 'salary', name: 'Salary', editable: true,
    valueFormatter: (v) => \`$\${v.toLocaleString()}\` },
];
</script>

<template>
  <OGrid
    :columns="columns"
    :data="employees"
    :getRowId="(e) => e.id"
    editable
    cellSelection
    statusBar
  />
</template>`;
    case 'js':
      return `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';

const grid = new OGrid(document.getElementById('grid'), {
  columns: [
    { columnId: 'name', name: 'Name', sortable: true },
    { columnId: 'role', name: 'Role',
      filterable: { type: 'multiSelect' } },
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
    <section className={styles.codePreview}>
      <div className={styles.codePreviewInner}>
        <h2 className={styles.sectionTitle}>One API. Four Frameworks.</h2>
        <p className={styles.sectionSubtitle}>
          Same props, same behavior. Just swap the import.
        </p>
        <div className={styles.codeCard}>
          <div className={styles.codeTabs}>
            {frameworks.map((fw, i) => (
              <button
                key={fw.id}
                className={`${styles.codeTab} ${i === active ? styles.codeTabActive : ''}`}
                onClick={() => setActive(i)}
              >
                {fw.label}
              </button>
            ))}
          </div>
          <div className={styles.codeBody}>
            <CodeBlock language={frameworks[active].id === 'vue' ? 'html' : frameworks[active].id === 'react' ? 'tsx' : 'typescript'}>
              {getCodeExample(frameworks[active])}
            </CodeBlock>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   Feature Grid (Bento)
   ────────────────────────────────────────────── */

const features: { title: string; desc: string; icon: string }[] = [
  { icon: '\u2195', title: 'Sorting', desc: 'Single-column sort with asc/desc toggle. Controlled or uncontrolled.' },
  { icon: '\u{1F50D}', title: 'Filtering', desc: 'Text, multi-select, and people picker filters with server-side support.' },
  { icon: '\u270F\uFE0F', title: 'Cell Editing', desc: 'Inline text, select, checkbox, and rich select editors with search.' },
  { icon: '\u2B1C', title: 'Spreadsheet Selection', desc: 'Click-and-drag cell range selection with active cell highlight.' },
  { icon: '\u{1F4CB}', title: 'Clipboard', desc: 'Ctrl+C / Ctrl+V / Ctrl+X with multi-cell paste support.' },
  { icon: '\u271A', title: 'Fill Handle', desc: 'Drag the cell corner to fill values down, just like Excel.' },
  { icon: '\u21A9\uFE0F', title: 'Undo / Redo', desc: 'Full undo/redo stack for cell edits. Ctrl+Z / Ctrl+Y.' },
  { icon: '\u2714\uFE0F', title: 'Row Selection', desc: 'Single or multi-select with Shift+click range support.' },
  { icon: '\u{1F4CB}', title: 'Pagination', desc: 'Client-side and server-side with configurable page sizes.' },
  { icon: '\u{1F4CA}', title: 'Column Groups', desc: 'Multi-row grouped headers with arbitrary nesting depth.' },
  { icon: '\u{1F4CC}', title: 'Column Pinning', desc: 'Pin columns to the left or right edge with sticky positioning.' },
  { icon: '\u2630', title: 'Column Chooser', desc: 'Show/hide columns with a dropdown picker.' },
  { icon: '\u{1F5B1}\uFE0F', title: 'Context Menu', desc: 'Right-click menu with copy, paste, export, undo/redo.' },
  { icon: '\u{1F4C8}', title: 'Status Bar', desc: 'Row count and selection aggregations (sum, avg, min, max).' },
  { icon: '\u{1F4E5}', title: 'CSV Export', desc: 'One-click export to CSV with formatted values.' },
  { icon: '\u{1F310}', title: 'Server-Side Data', desc: 'IDataSource interface for remote pagination and sorting.' },
  { icon: '\u2328\uFE0F', title: 'Keyboard Nav', desc: 'Arrow keys, Tab, Enter, F2, Home/End, Ctrl+Home/End.' },
  { icon: '\u{1F527}', title: 'Grid API', desc: 'Imperative ref API: setRowData, getColumnState, selectAll, and more.' },
];

function FeatureGridSection() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Everything You Need. Nothing You Don't.</h2>
      <p className={styles.sectionSubtitle}>
        20+ features built in. No enterprise paywall. No bloat.
      </p>
      <div className={styles.featureGrid}>
        {features.map((f) => (
          <div key={f.title} className={styles.featureCard}>
            <span className={styles.featureIcon}>{f.icon}</span>
            <div className={styles.featureTitle}>{f.title}</div>
            <div className={styles.featureDesc}>{f.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   Comparison Table
   ────────────────────────────────────────────── */

type CellType = 'check' | 'enterprise' | 'text';
interface CompRow {
  feature: string;
  ogrid: [CellType, string];
  aggrid: [CellType, string];
}

const compRows: CompRow[] = [
  { feature: 'Sorting & Filtering', ogrid: ['check', 'Built-in'], aggrid: ['check', 'Community (free)'] },
  { feature: 'Pagination', ogrid: ['check', 'Built-in'], aggrid: ['check', 'Community (free)'] },
  { feature: 'Cell Editing', ogrid: ['check', 'Built-in'], aggrid: ['check', 'Community (free)'] },
  { feature: 'Row Selection', ogrid: ['check', 'Built-in'], aggrid: ['check', 'Community (free)'] },
  { feature: 'Column Groups', ogrid: ['check', 'Built-in'], aggrid: ['check', 'Community (free)'] },
  { feature: 'CSV Export', ogrid: ['check', 'Built-in'], aggrid: ['check', 'Community (free)'] },
  { feature: 'Keyboard Navigation', ogrid: ['check', 'Built-in'], aggrid: ['check', 'Community (free)'] },
  { feature: 'Spreadsheet Selection', ogrid: ['check', 'Built-in'], aggrid: ['enterprise', 'Enterprise $999+/dev'] },
  { feature: 'Clipboard', ogrid: ['check', 'Built-in'], aggrid: ['enterprise', 'Enterprise $999+/dev'] },
  { feature: 'Fill Handle', ogrid: ['check', 'Built-in'], aggrid: ['enterprise', 'Enterprise $999+/dev'] },
  { feature: 'Undo / Redo', ogrid: ['check', 'Built-in'], aggrid: ['enterprise', 'Enterprise $999+/dev'] },
  { feature: 'Context Menu', ogrid: ['check', 'Built-in'], aggrid: ['enterprise', 'Enterprise $999+/dev'] },
  { feature: 'Status Bar', ogrid: ['check', 'Built-in'], aggrid: ['enterprise', 'Enterprise $999+/dev'] },
  { feature: 'Side Bar', ogrid: ['check', 'Built-in'], aggrid: ['enterprise', 'Enterprise $999+/dev'] },
  { feature: 'Server-Side Data', ogrid: ['check', 'Built-in'], aggrid: ['enterprise', 'Enterprise $999+/dev'] },
  { feature: 'Headless Core', ogrid: ['check', 'Yes'], aggrid: ['text', 'No'] },
  { feature: 'License', ogrid: ['check', 'MIT (free)'], aggrid: ['text', 'MIT / Commercial'] },
  { feature: 'Enterprise Cost', ogrid: ['check', '$0 (free forever)'], aggrid: ['enterprise', 'From $999/dev'] },
];

function renderCell(type: CellType, text: string) {
  switch (type) {
    case 'check': return <span className={styles.checkGreen}>{text}</span>;
    case 'enterprise': return <span className={styles.enterprise}>{text}</span>;
    default: return <span>{text}</span>;
  }
}

function ComparisonSection() {
  const ogridFeatures: Array<{ name: string; value: string; type: 'check' | 'free' }> = [
    { name: 'Sorting & Filtering', value: 'Built-in', type: 'check' },
    { name: 'Cell Editing', value: 'Built-in', type: 'check' },
    { name: 'Spreadsheet Selection', value: 'Built-in', type: 'check' },
    { name: 'Clipboard (Copy/Paste)', value: 'Built-in', type: 'check' },
    { name: 'Fill Handle', value: 'Built-in', type: 'check' },
    { name: 'Undo / Redo', value: 'Built-in', type: 'check' },
    { name: 'Context Menu', value: 'Built-in', type: 'check' },
    { name: 'Status Bar', value: 'Built-in', type: 'check' },
    { name: 'Side Bar', value: 'Built-in', type: 'check' },
    { name: 'Server-Side Data', value: 'Built-in', type: 'check' },
    { name: 'Headless Core', value: 'Yes', type: 'check' },
    { name: 'License', value: 'MIT (free forever)', type: 'free' },
    { name: 'Enterprise Cost', value: '$0', type: 'free' },
  ];

  const aggridFeatures: Array<{ name: string; value: string; type: 'check' | 'paid' | 'neutral' }> = [
    { name: 'Sorting & Filtering', value: 'Community (free)', type: 'check' },
    { name: 'Cell Editing', value: 'Community (free)', type: 'check' },
    { name: 'Spreadsheet Selection', value: 'Enterprise $999+/dev', type: 'paid' },
    { name: 'Clipboard (Copy/Paste)', value: 'Enterprise $999+/dev', type: 'paid' },
    { name: 'Fill Handle', value: 'Enterprise $999+/dev', type: 'paid' },
    { name: 'Undo / Redo', value: 'Enterprise $999+/dev', type: 'paid' },
    { name: 'Context Menu', value: 'Enterprise $999+/dev', type: 'paid' },
    { name: 'Status Bar', value: 'Enterprise $999+/dev', type: 'paid' },
    { name: 'Side Bar', value: 'Enterprise $999+/dev', type: 'paid' },
    { name: 'Server-Side Data', value: 'Enterprise $999+/dev', type: 'paid' },
    { name: 'Headless Core', value: 'No', type: 'neutral' },
    { name: 'License', value: 'MIT / Commercial', type: 'neutral' },
    { name: 'Enterprise Cost', value: 'From $999/dev', type: 'paid' },
  ];

  return (
    <section className={styles.comparison}>
      <div className={styles.comparisonInner}>
        <h2 className={styles.sectionTitle}>How OGrid Compares</h2>
        <p className={styles.sectionSubtitle}>
          Enterprise-grade features without the enterprise price tag.
        </p>

        <div className={styles.comparisonGrid}>
          {/* OGrid Card */}
          <div className={`${styles.comparisonCard} ${styles.comparisonCardOGrid}`}>
            <div className={styles.comparisonCardHeader}>
              <div className={`${styles.comparisonCardIcon} ${styles.comparisonCardIconOGrid}`}>
                OG
              </div>
              <div className={styles.comparisonCardTitle}>OGrid</div>
            </div>
            <ul className={styles.comparisonFeatureList}>
              {ogridFeatures.map((f) => (
                <li key={f.name} className={styles.comparisonFeatureItem}>
                  <span className={`${styles.comparisonFeatureIcon} ${styles.comparisonFeatureIconCheck}`}>
                    ✓
                  </span>
                  <div className={styles.comparisonFeatureText}>
                    <span className={styles.comparisonFeatureName}>{f.name}</span>
                    <span className={`${styles.comparisonFeatureValue} ${f.type === 'free' ? styles.comparisonFeatureValueFree : ''}`}>
                      {f.value}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* AG Grid Card */}
          <div className={`${styles.comparisonCard} ${styles.comparisonCardAggrid}`}>
            <div className={styles.comparisonCardHeader}>
              <div className={`${styles.comparisonCardIcon} ${styles.comparisonCardIconAggrid}`}>
                AG
              </div>
              <div className={styles.comparisonCardTitle}>AG Grid</div>
            </div>
            <ul className={styles.comparisonFeatureList}>
              {aggridFeatures.map((f) => (
                <li key={f.name} className={styles.comparisonFeatureItem}>
                  <span
                    className={`${styles.comparisonFeatureIcon} ${
                      f.type === 'check'
                        ? styles.comparisonFeatureIconCheck
                        : f.type === 'paid'
                        ? styles.comparisonFeatureIconEnterprise
                        : styles.comparisonFeatureIconNeutral
                    }`}
                  >
                    {f.type === 'check' ? '✓' : f.type === 'paid' ? '$' : '—'}
                  </span>
                  <div className={styles.comparisonFeatureText}>
                    <span className={styles.comparisonFeatureName}>{f.name}</span>
                    <span className={`${styles.comparisonFeatureValue} ${f.type === 'paid' ? styles.comparisonFeatureValuePaid : ''}`}>
                      {f.value}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   CTA
   ────────────────────────────────────────────── */

function CTASection() {
  return (
    <section className={styles.cta}>
      <div className={styles.ctaGradient} />
      <div className={styles.ctaContent}>
        <h2 className={styles.ctaTitle}>Ready to Ship?</h2>
        <p className={styles.ctaSubtitle}>
          Get started in under 5 minutes. Free. MIT licensed. No strings attached.
        </p>
        <PackagesGrid />
        <RotatingInstallCommand />
        <div className={styles.ctaButtons}>
          <Link className={styles.btnPrimary} to="/docs/getting-started/overview">
            Read the Docs
          </Link>
          <Link
            className={styles.btnGhost}
            href="https://github.com/alaarab/ogrid"
          >
            View on GitHub
          </Link>
          <Link className={styles.btnGhost} to="/docs/guides/framework-showcase">
            Framework Showcase
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
      title="Every Spreadsheet Feature. Zero Enterprise Tax."
      description="Lightweight, framework-agnostic React data grid with sorting, filtering, editing, spreadsheet selection, clipboard, and more. Free and open source."
    >
      <Hero />
      <CodePreviewSection />
      <FeatureGridSection />
      <ComparisonSection />
      <CTASection />
    </Layout>
  );
}
