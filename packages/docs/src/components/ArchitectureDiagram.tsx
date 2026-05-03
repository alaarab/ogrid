import React from 'react';

/* ─────────────────────────────────────────────────────────────
   Architecture Diagram  -  Dependency tree showing OGrid's
   3-layer architecture across the active React packages.

   Layout (top  to  bottom = UI  to  Adapter  to  Core):

   ┌────────────────┐  ┌────────────────┐
   │ ogrid-react-   │  │ ogrid-react-   │
   │ radix          │  │ fluent         │
   └───────┬────────┘  └───────┬────────┘
           │                   │
           └─────────┬─────────┘
                     │
              ┌──────▼──────┐
              │ ogrid-react │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │ ogrid-core  │
              └─────────────┘
   ───────────────────────────────────────────────────────────── */

const COLORS = {
  react: { border: '#2d7a4f', bg: '#e8f5e9', text: '#1a4a2e', adapterBg: '#c8e6c9' },
  core: { border: '#3ab876', bg: '#1a2e1a', text: '#3ab876' },
};

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

interface BoxProps {
  name: string;
  description: string;
  useAdapterBg?: boolean;
  style?: React.CSSProperties;
}

function PkgBox({ name, description, useAdapterBg, style }: BoxProps) {
  const c = COLORS.react;
  return (
    <div
      style={{
        ...boxBase,
        borderColor: c.border,
        backgroundColor: useAdapterBg ? c.adapterBg : c.bg,
        ...style,
      }}
    >
      <div style={{ ...monoTitle, color: c.text }}>@alaarab/{name}</div>
      <div style={{ ...subLabel, color: c.text }}>{description}</div>
    </div>
  );
}

function VertConnector({ height = 24 }: { height?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'stretch',
        height,
      }}
    >
      <div
        style={{
          width: 2,
          backgroundColor: COLORS.react.border,
          opacity: 0.45,
          borderRadius: 1,
        }}
      />
    </div>
  );
}

function UiToAdapterConnector() {
  // Two columns drop into one centered point.
  const color = 'rgba(45,122,79,0.45)';
  return (
    <div style={{ position: 'relative', height: 36, marginTop: 0 }}>
      <svg
        viewBox="0 0 1000 36"
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Vertical drops from each UI box */}
        <line x1={250} y1={0} x2={250} y2={18} stroke={color} strokeWidth={2} />
        <line x1={750} y1={0} x2={750} y2={18} stroke={color} strokeWidth={2} />
        {/* Horizontal join */}
        <line x1={250} y1={18} x2={750} y2={18} stroke={color} strokeWidth={2} />
        {/* Single drop to adapter */}
        <line x1={500} y1={18} x2={500} y2={36} stroke={color} strokeWidth={2} />
        <polygon points="494,32 506,32 500,36" fill={color} />
      </svg>
    </div>
  );
}

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

export function ArchitectureDiagram() {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: '2rem auto',
        fontFamily: 'var(--ifm-font-family-base)',
        userSelect: 'none',
      }}
    >
      <LayerLabel>UI Packages</LayerLabel>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }}
      >
        <PkgBox name="ogrid-react-radix" description="Radix Primitives" />
        <PkgBox name="ogrid-react-fluent" description="Fluent UI v9" />
      </div>

      <UiToAdapterConnector />

      <LayerLabel style={{ marginTop: 0 }}>React Adapter</LayerLabel>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '60%', minWidth: 280 }}>
          <PkgBox
            name="ogrid-react"
            description="Hooks · Headless components"
            useAdapterBg
            style={{ borderWidth: 2, fontWeight: 700 }}
          />
        </div>
      </div>

      <VertConnector />

      <LayerLabel style={{ marginTop: 0 }}>Core</LayerLabel>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '60%', minWidth: 300 }}>
          <CoreBox />
        </div>
      </div>
    </div>
  );
}
