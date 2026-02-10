import React, { useState, useMemo } from 'react';
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
}

const FIRST_NAMES = ['James','Emma','Liam','Olivia','Noah','Ava','William','Sophia','Benjamin','Isabella','Lucas','Mia','Henry','Charlotte','Alexander','Amelia','Daniel','Harper','Matthew','Evelyn','Sebastian','Abigail','Jack','Emily','Aiden','Elizabeth','Owen','Sofia','Samuel','Avery','Ryan','Ella','Nathan','Scarlett','Leo','Grace','Isaac','Lily','Ethan','Chloe','Mason','Penelope','Logan','Layla','Jacob','Riley','Michael','Zoey','Elijah','Nora'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts'];
const DEPARTMENTS = ['Engineering','Product','Design','Marketing','Sales','Finance','HR','Legal','Operations','Support'];
const TITLES = ['Software Engineer','Product Manager','UX Designer','Data Analyst','Sales Executive','Account Manager','HR Specialist','Legal Counsel','DevOps Engineer','Support Lead','Frontend Developer','Backend Developer','QA Engineer','Scrum Master','Tech Lead','Marketing Manager','Content Strategist','BD Manager','Recruiter','Finance Analyst'];
const STATUSES: string[] = ['Active','Active','Active','Active','Active','Active','Active','Remote','Remote','On Leave'];
const RATINGS = ['A+','A','A','A-','B+','B+','B','B','A','A-'];

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
    });
  }
  return rows;
}

function HeroGrid() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { OGrid } = require('@alaarab/ogrid') as typeof import('@alaarab/ogrid');

  const data = useMemo(() => generateData(), []);

  const columns = useMemo(() => [
    { columnId: 'id', name: '#', type: 'numeric' as const, defaultWidth: 55 },
    { columnId: 'name', name: 'Name', sortable: true, editable: true, defaultWidth: 160 },
    { columnId: 'department', name: 'Department', sortable: true, filterable: { type: 'multiSelect' as const }, defaultWidth: 120 },
    { columnId: 'title', name: 'Title', sortable: true, defaultWidth: 175 },
    { columnId: 'email', name: 'Email', defaultWidth: 220 },
    { columnId: 'salary', name: 'Salary', type: 'numeric' as const, editable: true, valueFormatter: (v: unknown) => v != null ? `$${Number(v).toLocaleString()}` : '', defaultWidth: 110 },
    { columnId: 'startDate', name: 'Start Date', type: 'date' as const, sortable: true, defaultWidth: 105 },
    { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect' as const }, defaultWidth: 90 },
    { columnId: 'rating', name: 'Rating', sortable: true, filterable: { type: 'multiSelect' as const }, defaultWidth: 75 },
  ], []);

  return (
    <div className={styles.heroGridWrapper}>
      <OGrid
        columns={columns}
        data={data}
        getRowId={(row: EmployeeRow) => row.id}
        editable
        cellSelection
        statusBar
        defaultPageSize={100}
        layoutMode="fill"
        entityLabelPlural="employees"
      />
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
          A lightweight React data grid with sorting, filtering, editing, selection,
          clipboard, and more. Pick your framework. Free forever.
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
        <div className={styles.heroInstall}>
          <span className={styles.heroInstallDollar}>$</span>
          npm install @alaarab/ogrid
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   Code Preview (Framework Tabs)
   ────────────────────────────────────────────── */

const frameworks = [
  { id: 'ogrid', label: 'OGrid (Default)', import: `import { OGrid } from '@alaarab/ogrid';` },
  { id: 'fluent', label: 'Fluent UI', import: `import { OGrid } from '@alaarab/ogrid-fluent';` },
  { id: 'material', label: 'Material UI', import: `import { OGrid } from '@alaarab/ogrid-material';` },
] as const;

function getCodeExample(importLine: string) {
  return `${importLine}
import type { IColumnDef } from '@alaarab/ogrid-core';

const columns: IColumnDef<Employee>[] = [
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

  return (
    <section className={styles.codePreview}>
      <div className={styles.codePreviewInner}>
        <h2 className={styles.sectionTitle}>One API. Three Frameworks.</h2>
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
            <CodeBlock language="tsx">
              {getCodeExample(frameworks[active].import)}
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
  return (
    <section className={styles.comparison}>
      <div className={styles.comparisonInner}>
        <h2 className={styles.sectionTitle}>How OGrid Compares</h2>
        <p className={styles.sectionSubtitle}>
          Enterprise-grade features without the enterprise price tag.
        </p>
        <table className={styles.comparisonTable}>
          <thead>
            <tr>
              <th>Feature</th>
              <th>OGrid</th>
              <th>AG Grid</th>
            </tr>
          </thead>
          <tbody>
            {compRows.map((row) => (
              <tr key={row.feature}>
                <td>{row.feature}</td>
                <td>{renderCell(...row.ogrid)}</td>
                <td>{renderCell(...row.aggrid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <div className={styles.ctaInstall}>
          <span className={styles.heroInstallDollar}>$</span>
          npm install @alaarab/ogrid
        </div>
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
