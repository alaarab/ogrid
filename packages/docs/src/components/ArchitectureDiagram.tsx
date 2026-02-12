import React from 'react';

/* ─────────────────────────────────────────────────────────────
   Architecture Diagram — Clean grid layout showing OGrid's
   3-layer architecture with framework packages
   ───────────────────────────────────────────────────────────── */

const styles = {
  container: {
    maxWidth: 1000,
    margin: '2rem auto',
    fontFamily: 'var(--ifm-font-family-base)',
  } as React.CSSProperties,

  row: {
    display: 'grid',
    gap: '16px',
    marginBottom: '24px',
  } as React.CSSProperties,

  box: {
    padding: '16px 20px',
    borderRadius: 8,
    border: '2px solid',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    minHeight: 90,
    justifyContent: 'center',
  } as React.CSSProperties,

  boxTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    fontFamily: 'var(--ifm-font-family-monospace)',
    letterSpacing: '-0.01em',
  } as React.CSSProperties,

  boxSubtitle: {
    fontSize: '0.78rem',
    opacity: 0.85,
    lineHeight: 1.4,
  } as React.CSSProperties,

  connectionLine: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '-8px 0',
    color: 'var(--ifm-color-emphasis-400)',
  } as React.CSSProperties,

  arrow: {
    fontSize: '1.8rem',
    opacity: 0.5,
  } as React.CSSProperties,

  legend: {
    display: 'flex',
    gap: '24px',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '20px',
    fontSize: '0.8rem',
    color: 'var(--ifm-color-emphasis-700)',
  } as React.CSSProperties,

  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,

  legendDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    border: '2px solid',
  } as React.CSSProperties,
};

interface Package {
  name: string;
  description: string;
  color: string;
  bgColor: string;
}

const packages = {
  // UI Layer (Top)
  reactUI: [
    { name: 'ogrid-react-radix', description: 'Radix Primitives', color: '#1a4a2e', bgColor: '#e8f5e9' },
    { name: 'ogrid-react-fluent', description: 'Fluent UI v9', color: '#1a4a2e', bgColor: '#e8f5e9' },
    { name: 'ogrid-react-material', description: 'Material UI v7', color: '#1a4a2e', bgColor: '#e8f5e9' },
  ] as Package[],
  angularUI: [
    { name: 'ogrid-angular-material', description: 'Angular Material v21', color: '#9a0025', bgColor: '#fce4ec' },
    { name: 'ogrid-angular-primeng', description: 'PrimeNG v21', color: '#9a0025', bgColor: '#fce4ec' },
  ] as Package[],
  vueUI: [
    { name: 'ogrid-vue-vuetify', description: 'Vuetify 3', color: '#35946b', bgColor: '#e0f2f1' },
    { name: 'ogrid-vue-primevue', description: 'PrimeVue 4', color: '#35946b', bgColor: '#e0f2f1' },
  ] as Package[],

  // Framework Adapter Layer (Middle)
  frameworks: [
    { name: 'ogrid-react', description: 'Hooks · Headless Components', color: '#1a4a2e', bgColor: '#c8e6c9' },
    { name: 'ogrid-angular', description: 'Services · Signals · Components', color: '#9a0025', bgColor: '#f8bbd0' },
    { name: 'ogrid-vue', description: 'Composables · Utilities', color: '#35946b', bgColor: '#a7ffeb' },
    { name: 'ogrid-js', description: 'Vanilla JS Grid', color: '#d97706', bgColor: '#fff3e0' },
  ] as Package[],

  // Core Layer (Bottom)
  core: {
    name: 'ogrid-core',
    description: 'Types · Algorithms · Utilities (zero deps)',
    color: '#3ab876',
    bgColor: '#1a1a1a',
  } as Package,
};

function PackageBox({ pkg }: { pkg: Package }) {
  return (
    <div
      style={{
        ...styles.box,
        borderColor: pkg.color,
        backgroundColor: pkg.bgColor,
      }}
    >
      <div style={{ ...styles.boxTitle, color: pkg.color }}>
        @alaarab/{pkg.name}
      </div>
      <div style={{ ...styles.boxSubtitle, color: pkg.color }}>
        {pkg.description}
      </div>
    </div>
  );
}

export function ArchitectureDiagram() {
  return (
    <div style={styles.container}>
      {/* UI Layer — React */}
      <div style={{ ...styles.row, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {packages.reactUI.map((pkg) => (
          <PackageBox key={pkg.name} pkg={pkg} />
        ))}
      </div>

      {/* UI Layer — Angular & Vue */}
      <div style={{ ...styles.row, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {packages.angularUI.map((pkg) => (
          <PackageBox key={pkg.name} pkg={pkg} />
        ))}
        <div /> {/* Spacer */}
        {packages.vueUI.map((pkg) => (
          <PackageBox key={pkg.name} pkg={pkg} />
        ))}
      </div>

      {/* Connection Line */}
      <div style={styles.connectionLine}>
        <div style={styles.arrow}>↓</div>
      </div>

      {/* Framework Adapter Layer */}
      <div style={{ ...styles.row, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {packages.frameworks.map((pkg) => (
          <PackageBox key={pkg.name} pkg={pkg} />
        ))}
      </div>

      {/* Connection Line */}
      <div style={styles.connectionLine}>
        <div style={styles.arrow}>↓</div>
      </div>

      {/* Core Layer */}
      <div style={{ ...styles.row, gridTemplateColumns: '1fr' }}>
        <div
          style={{
            ...styles.box,
            borderColor: packages.core.color,
            backgroundColor: packages.core.bgColor,
            minHeight: 100,
          }}
        >
          <div style={{ ...styles.boxTitle, color: packages.core.color }}>
            @alaarab/{packages.core.name}
          </div>
          <div style={{ ...styles.boxSubtitle, color: packages.core.color }}>
            {packages.core.description}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, borderColor: '#1a4a2e', backgroundColor: '#c8e6c9' }} />
          <span>React</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, borderColor: '#9a0025', backgroundColor: '#f8bbd0' }} />
          <span>Angular</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, borderColor: '#35946b', backgroundColor: '#a7ffeb' }} />
          <span>Vue</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, borderColor: '#d97706', backgroundColor: '#fff3e0' }} />
          <span>Vanilla JS</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, borderColor: '#3ab876', backgroundColor: '#1a1a1a' }} />
          <span>Core</span>
        </div>
      </div>
    </div>
  );
}
