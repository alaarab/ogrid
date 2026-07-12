import React, { useState } from 'react';

/* ─── Style objects at module scope (stable refs, no re-creation) ─── */

const container: React.CSSProperties = {
  border: '2px solid var(--ogrid-border)',
  borderRadius: 12,
  overflow: 'hidden',
  fontFamily: 'var(--ifm-font-family-base)',
  fontSize: '0.82rem',
  lineHeight: 1.5,
  maxWidth: 640,
  margin: '1.5rem auto',
  background: 'var(--ogrid-bg)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
};

const sectionLabel: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '0.8rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  color: 'var(--ifm-font-color-base)',
  marginBottom: 6,
};

const sectionHint: React.CSSProperties = {
  fontSize: '0.78rem',
  color: 'var(--ifm-color-emphasis-600)',
  marginTop: 4,
  lineHeight: 1.6,
};

const toolbarStrip: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 16px',
  background: 'var(--ogrid-header-bg)',
  borderBottom: '1px solid var(--ogrid-border)',
};

const secondaryToolbarStrip: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--ogrid-header-bg)',
  borderBottom: '1px solid var(--ogrid-border)',
};

const middleRow: React.CSSProperties = {
  display: 'flex',
  minHeight: 130,
};

const sidebarCell: React.CSSProperties = {
  width: 130,
  flexShrink: 0,
  padding: '12px 14px',
  background: 'var(--ogrid-bg-subtle)',
  borderRight: '1px solid var(--ogrid-border)',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const gridCell: React.CSSProperties = {
  flex: 1,
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--ogrid-bg)',
};

const statusBarArea: React.CSSProperties = {
  marginTop: 'auto',
  paddingTop: 8,
  borderTop: '1px dashed var(--ogrid-border)',
  fontSize: '0.76rem',
  color: 'var(--ifm-color-emphasis-600)',
};

const footerStrip: React.CSSProperties = {
  padding: '10px 16px',
  background: 'var(--ogrid-header-bg)',
  borderTop: '1px solid var(--ogrid-border)',
};

const pillBase: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '0.68rem',
  fontWeight: 600,
  fontFamily: 'var(--ifm-font-family-monospace)',
  letterSpacing: '0.02em',
  borderRadius: 4,
  padding: '2px 8px',
  lineHeight: '20px',
  transition: 'all 0.2s ease',
};

const getPillStyle = (hovered: boolean, color: string): React.CSSProperties => ({
  ...pillBase,
  background: hovered ? color : `${color}20`,
  color: hovered ? 'white' : color,
  border: `1.5px solid ${color}`,
  transform: hovered ? 'scale(1.05)' : 'scale(1)',
  cursor: 'pointer',
});

const dotSeparator: React.CSSProperties = {
  margin: '0 8px',
  color: 'var(--ifm-color-emphasis-400)',
};

export function LayoutDiagram() {
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);

  const colors = {
    toolbar: '#3ab876',
    toolbarBelow: '#8b5cf6',
    columnChooser: '#0066cc',
    sidebar: '#f59e0b',
    grid: '#217346',
    statusBar: '#ec4899',
    footer: '#06b6d4',
  };

  return (
    <div style={container} role="img" aria-label="OGrid layout anatomy diagram">
      {/* Toolbar Strip */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: decorative anatomy diagram (container has role="img"); hover handlers only drive a visual highlight */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: decorative anatomy diagram; hover-only highlight, no click functionality */}
      <div
        style={{
          ...toolbarStrip,
          background: hoveredSection === 'toolbar' ? 'rgba(58, 184, 118, 0.08)' : toolbarStrip.background,
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={() => setHoveredSection('toolbar')}
        onMouseLeave={() => setHoveredSection(null)}
      >
        <div>
          <div style={sectionLabel}>Toolbar Strip</div>
          <div style={sectionHint}>
            {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: decorative anatomy diagram (container has role="img"); hover handlers only drive a visual highlight */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: decorative anatomy diagram; hover-only highlight, no click functionality */}
            <span
              style={getPillStyle(hoveredSection === 'toolbar', colors.toolbar)}
              onMouseEnter={() => setHoveredSection('toolbar')}
            >
              toolbar
            </span>
            <span style={dotSeparator}>&middot;</span>
            Custom buttons, search, status
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...sectionHint, marginTop: 0 }}>
            {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: decorative anatomy diagram (container has role="img"); hover handlers only drive a visual highlight */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: decorative anatomy diagram; hover-only highlight, no click functionality */}
            <span
              style={getPillStyle(hoveredSection === 'columnChooser', colors.columnChooser)}
              onMouseEnter={() => setHoveredSection('columnChooser')}
              onMouseLeave={() => setHoveredSection(null)}
            >
              columnChooser
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Toolbar Row */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: decorative anatomy diagram (container has role="img"); hover handlers only drive a visual highlight */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: decorative anatomy diagram; hover-only highlight, no click functionality */}
      <div
        style={{
          ...secondaryToolbarStrip,
          background: hoveredSection === 'toolbarBelow' ? 'rgba(139, 92, 246, 0.08)' : secondaryToolbarStrip.background,
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={() => setHoveredSection('toolbarBelow')}
        onMouseLeave={() => setHoveredSection(null)}
      >
        <div style={sectionHint}>
          <span style={getPillStyle(hoveredSection === 'toolbarBelow', colors.toolbarBelow)}>
            toolbarBelow
          </span>
          <span style={dotSeparator}>&middot;</span>
          Filter chips, breadcrumbs, secondary actions
        </div>
      </div>

      {/* Middle: Sidebar + Grid */}
      <div style={middleRow}>
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: decorative anatomy diagram (container has role="img"); hover handlers only drive a visual highlight */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: decorative anatomy diagram; hover-only highlight, no click functionality */}
        <div
          style={{
            ...sidebarCell,
            background: hoveredSection === 'sidebar' ? 'rgba(245, 158, 11, 0.08)' : sidebarCell.background,
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={() => setHoveredSection('sidebar')}
          onMouseLeave={() => setHoveredSection(null)}
        >
          <div style={sectionLabel}>Sidebar</div>
          <div style={sectionHint}>
            <span style={getPillStyle(hoveredSection === 'sidebar', colors.sidebar)}>
              sideBar
            </span>
          </div>
          <div style={{ ...sectionHint, fontSize: '0.72rem', marginTop: 8 }}>
            Columns panel<br />
            Filters panel
          </div>
        </div>
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: decorative anatomy diagram (container has role="img"); hover handlers only drive a visual highlight */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: decorative anatomy diagram; hover-only highlight, no click functionality */}
        <div
          style={{
            ...gridCell,
            background: hoveredSection === 'grid' ? 'rgba(33, 115, 70, 0.04)' : gridCell.background,
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={() => setHoveredSection('grid')}
          onMouseLeave={() => setHoveredSection(null)}
        >
          <div style={sectionLabel}>Data Grid</div>
          <div style={sectionHint}>
            Column headers, rows, inline editing
          </div>
          {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: decorative anatomy diagram (container has role="img"); hover handlers only drive a visual highlight */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: decorative anatomy diagram; hover-only highlight, no click functionality */}
          <div
            style={{
              ...statusBarArea,
              background: hoveredSection === 'statusBar' ? 'rgba(236, 72, 153, 0.06)' : 'transparent',
              margin: '12px -16px -12px',
              padding: '12px 16px',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={() => setHoveredSection('statusBar')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <span style={getPillStyle(hoveredSection === 'statusBar', colors.statusBar)}>
              statusBar
            </span>
            <span style={dotSeparator}>&middot;</span>
            Row count, aggregations
          </div>
        </div>
      </div>

      {/* Footer Strip */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: decorative anatomy diagram (container has role="img"); hover handlers only drive a visual highlight */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: decorative anatomy diagram; hover-only highlight, no click functionality */}
      <div
        style={{
          ...footerStrip,
          background: hoveredSection === 'footer' ? 'rgba(6, 182, 212, 0.08)' : footerStrip.background,
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={() => setHoveredSection('footer')}
        onMouseLeave={() => setHoveredSection(null)}
      >
        <div style={sectionLabel}>Footer Strip</div>
        <div style={sectionHint}>
          <span style={getPillStyle(hoveredSection === 'footer', colors.footer)}>
            pagination
          </span>
          <span style={dotSeparator}>&middot;</span>
          Page controls, page size selector
        </div>
      </div>
    </div>
  );
}
