import React from 'react';

/* ─────────────────────────────────────────────────────────────
   Architecture Diagram — Dependency tree showing OGrid's
   3-layer architecture across all 14 packages.

   Layout (4 columns, top → bottom = UI → Adapter → Core):

   React col     Angular col    Vue col       JS col
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │react-radix│  │ang-mat   │  │vue-vuetify│
   ├──────────┤  ├──────────┤  ├──────────┤
   │react-fluent│ │ang-primeng│  │vue-primevue│
   ├──────────┤  ├──────────┤  ├──────────┤
   │react-mat │  │ang-radix  │  │vue-radix  │
   └────┬─────┘  └────┬──────┘  └────┬─────┘
        │              │               │
   ┌────▼─────┐  ┌────▼──────┐  ┌────▼─────┐  ┌──────────┐
   │ogrid-react│  │ogrid-angular│ │ogrid-vue │  │ogrid-js  │
   └────┬─────┘  └────┬──────┘  └────┬─────┘  └────┬─────┘
        └──────────────┴───────────────┴─────────────┘
                                 │
                        ┌────────▼────────┐
                        │   ogrid-core     │
                        └─────────────────┘
   ───────────────────────────────────────────────────────────── */

// ─── Color tokens ───────────────────────────────────────────
const COLORS = {
  react:   { border: '#2d7a4f', bg: '#e8f5e9', text: '#1a4a2e', adapterBg: '#c8e6c9' },
  angular: { border: '#c2185b', bg: '#fce4ec', text: '#880e4f', adapterBg: '#f8bbd0' },
  vue:     { border: '#00897b', bg: '#e0f2f1', text: '#004d40', adapterBg: '#b2dfdb' },
  js:      { border: '#e65100', bg: '#fff3e0', text: '#bf360c', adapterBg: '#ffe0b2' },
  core:    { border: '#3ab876', bg: '#1a2e1a', text: '#3ab876', adapterBg: '#1a2e1a' },
};

// ─── Shared style helpers ────────────────────────────────────
const boxBase: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 6,
  border: '2px solid',
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
};

const monoTitle: React.CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  fontFamily: 'var(--ifm-font-family-monospace)',
  letterSpacing: '-0.01em',
  lineHeight: 1.3,
};

const subLabel: React.CSSProperties = {
  fontSize: '0.72rem',
  opacity: 0.85,
  lineHeight: 1.3,
};

// ─── Box components ──────────────────────────────────────────
interface BoxProps {
  name: string;
  description: string;
  colors: typeof COLORS['react'];
  useAdapterBg?: boolean;
  style?: React.CSSProperties;
}

function PkgBox({ name, description, colors, useAdapterBg, style }: BoxProps) {
  return (
    <div
      style={{
        ...boxBase,
        borderColor: colors.border,
        backgroundColor: useAdapterBg ? colors.adapterBg : colors.bg,
        ...style,
      }}
    >
      <div style={{ ...monoTitle, color: colors.text }}>@alaarab/{name}</div>
      <div style={{ ...subLabel, color: colors.text }}>{description}</div>
    </div>
  );
}

// ─── Connector: vertical line between UI tier and adapter ────
function VertConnector({ color }: { color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'stretch',
        height: 24,
      }}
    >
      <div
        style={{
          width: 2,
          backgroundColor: color,
          opacity: 0.45,
          borderRadius: 1,
        }}
      />
    </div>
  );
}

// ─── Column: UI packages stacked above their adapter ─────────
interface ColumnProps {
  uiPackages: Array<{ name: string; description: string }>;
  adapterName: string;
  adapterDescription: string;
  colors: typeof COLORS['react'];
}

function FrameworkColumn({ uiPackages, adapterName, adapterDescription, colors }: ColumnProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* UI tier */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {uiPackages.map((pkg) => (
          <PkgBox
            key={pkg.name}
            name={pkg.name}
            description={pkg.description}
            colors={colors}
          />
        ))}
      </div>

      {/* Connector: UI tier → adapter */}
      <VertConnector color={colors.border} />

      {/* Adapter tier */}
      <PkgBox
        name={adapterName}
        description={adapterDescription}
        colors={colors}
        useAdapterBg
        style={{ borderWidth: 2, fontWeight: 700 }}
      />
    </div>
  );
}

// ─── JS column: no UI children, just the adapter ─────────────
function JsColumn() {
  const c = COLORS.js;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {/* Spacer so adapter aligns with other columns' adapter row */}
      <div style={{ flex: 1 }} />
      <PkgBox
        name="ogrid-js"
        description="Vanilla JS Grid · No framework"
        colors={c}
        useAdapterBg
        style={{ borderWidth: 2, fontWeight: 700 }}
      />
    </div>
  );
}

// ─── Multi-column connector (adapter row → core) ─────────────
function AdapterToCoreConnector() {
  /*
    Draws a horizontal bar connecting 4 columns with a vertical
    drop into core. Uses an SVG so we get crisp lines at any size.

    SVG layout (viewBox 0 0 1000 40):
      four tick marks at ~12.5%, 37.5%, 62.5%, 87.5% of width
      horizontal bar connecting the ticks
      single vertical drop from the midpoint to the bottom
  */
  const color = 'rgba(100,120,100,0.45)';
  return (
    <div style={{ position: 'relative', height: 40, marginTop: 0 }}>
      <svg
        viewBox="0 0 1000 40"
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Vertical ticks rising from each column's adapter center */}
        {[125, 375, 625, 875].map((x) => (
          <line key={x} x1={x} y1={0} x2={x} y2={20} stroke={color} strokeWidth={2} />
        ))}
        {/* Horizontal spanning bar */}
        <line x1={125} y1={20} x2={875} y2={20} stroke={color} strokeWidth={2} />
        {/* Single drop to core */}
        <line x1={500} y1={20} x2={500} y2={40} stroke={color} strokeWidth={2} />
        {/* Arrowhead */}
        <polygon points="494,36 506,36 500,40" fill={color} />
      </svg>
    </div>
  );
}

// ─── Core box ────────────────────────────────────────────────
function CoreBox() {
  const c = COLORS.core;
  return (
    <div
      style={{
        ...boxBase,
        borderColor: c.border,
        backgroundColor: c.bg,
        textAlign: 'center',
        padding: '16px 20px',
      }}
    >
      <div
        style={{
          ...monoTitle,
          color: c.text,
          fontSize: '0.9rem',
        }}
      >
        @alaarab/ogrid-core
      </div>
      <div style={{ ...subLabel, color: c.text }}>
        Types · Algorithms · Utilities &nbsp;·&nbsp; zero dependencies
      </div>
    </div>
  );
}

// ─── Legend ──────────────────────────────────────────────────
interface LegendEntry {
  label: string;
  colors: typeof COLORS['react'];
}

const LEGEND: LegendEntry[] = [
  { label: 'React', colors: COLORS.react },
  { label: 'Angular', colors: COLORS.angular },
  { label: 'Vue', colors: COLORS.vue },
  { label: 'Vanilla JS', colors: COLORS.js },
  { label: 'Core', colors: COLORS.core },
];

function Legend() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
        flexWrap: 'wrap',
        fontSize: '0.8rem',
        color: 'var(--ifm-color-emphasis-700)',
      }}
    >
      {LEGEND.map(({ label, colors }) => (
        <div
          key={label}
          style={{ display: 'flex', alignItems: 'center', gap: 7 }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: `2px solid ${colors.border}`,
              backgroundColor: colors.adapterBg,
              flexShrink: 0,
            }}
          />
          <span>{label}</span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <svg
          width="28"
          height="10"
          aria-hidden="true"
          style={{ flexShrink: 0, display: 'block' }}
        >
          <line
            x1="0" y1="5" x2="22" y2="5"
            stroke="rgba(100,120,100,0.6)"
            strokeWidth="2"
          />
          <polygon points="18,2 26,5 18,8" fill="rgba(100,120,100,0.6)" />
        </svg>
        <span>depends on</span>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────
export function ArchitectureDiagram() {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: '2rem auto',
        fontFamily: 'var(--ifm-font-family-base)',
        userSelect: 'none',
      }}
    >
      {/* Layer label */}
      <LayerLabel>UI Packages</LayerLabel>

      {/* 4-column grid: React | Angular | Vue | JS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          alignItems: 'end',
        }}
      >
        <FrameworkColumn
          uiPackages={[
            { name: 'ogrid-react-radix',    description: 'Radix Primitives' },
            { name: 'ogrid-react-fluent',   description: 'Fluent UI v9' },
            { name: 'ogrid-react-material', description: 'Material UI v7' },
          ]}
          adapterName="ogrid-react"
          adapterDescription="Hooks · Headless Components"
          colors={COLORS.react}
        />

        <FrameworkColumn
          uiPackages={[
            { name: 'ogrid-angular-material', description: 'Angular Material v21' },
            { name: 'ogrid-angular-primeng',  description: 'PrimeNG v21' },
            { name: 'ogrid-angular-radix',    description: 'Radix UI (Angular)' },
          ]}
          adapterName="ogrid-angular"
          adapterDescription="Services · Signals · Components"
          colors={COLORS.angular}
        />

        <FrameworkColumn
          uiPackages={[
            { name: 'ogrid-vue-vuetify',  description: 'Vuetify 3' },
            { name: 'ogrid-vue-primevue', description: 'PrimeVue 4' },
            { name: 'ogrid-vue-radix',    description: 'Radix UI (Vue)' },
          ]}
          adapterName="ogrid-vue"
          adapterDescription="Composables · Utilities"
          colors={COLORS.vue}
        />

        <JsColumn />
      </div>

      {/* Layer label */}
      <LayerLabel style={{ marginTop: 0 }}>Framework Adapters</LayerLabel>

      {/* Connector: 4 adapters → core */}
      <AdapterToCoreConnector />

      {/* Layer label */}
      <LayerLabel style={{ marginTop: 0 }}>Core</LayerLabel>

      {/* Core box — centered, narrower */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '60%', minWidth: 300 }}>
          <CoreBox />
        </div>
      </div>

      {/* Legend */}
      <Legend />
    </div>
  );
}

// ─── Small layer label ────────────────────────────────────────
function LayerLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        textAlign: 'center',
        fontSize: '0.72rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--ifm-color-emphasis-500)',
        marginBottom: 8,
        marginTop: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
