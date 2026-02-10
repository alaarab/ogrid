import React from 'react';

/* ─── Style objects at module scope (stable refs, no re-creation) ─── */

const container: React.CSSProperties = {
  border: '1px solid var(--ogrid-border)',
  borderRadius: 6,
  overflow: 'hidden',
  fontFamily: 'var(--ifm-font-family-base)',
  fontSize: '0.82rem',
  lineHeight: 1.5,
  maxWidth: 580,
  margin: '1.5rem 0',
  background: 'var(--ogrid-bg)',
};

const sectionLabel: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '0.78rem',
  letterSpacing: '0.03em',
  textTransform: 'uppercase' as const,
  color: 'var(--ifm-font-color-base)',
};

const sectionHint: React.CSSProperties = {
  fontSize: '0.76rem',
  color: 'var(--ifm-color-emphasis-600)',
  marginTop: 2,
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

const pill: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '0.65rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  color: 'var(--ogrid-primary)',
  border: '1px solid var(--ogrid-primary)',
  borderRadius: 3,
  padding: '0 5px',
  lineHeight: '18px',
  opacity: 0.8,
};

const dotSeparator: React.CSSProperties = {
  margin: '0 8px',
  color: 'var(--ifm-color-emphasis-400)',
};

export function LayoutDiagram() {
  return (
    <div style={container} role="img" aria-label="OGrid layout anatomy diagram">
      {/* Toolbar Strip */}
      <div style={toolbarStrip}>
        <div>
          <div style={sectionLabel}>Toolbar Strip</div>
          <div style={sectionHint}>
            <span style={pill}>toolbar</span>
            <span style={dotSeparator}>&middot;</span>
            Custom buttons, search, status
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...sectionHint, marginTop: 0 }}>
            <span style={pill}>columnChooser</span>
          </div>
        </div>
      </div>

      {/* Secondary Toolbar Row */}
      <div style={secondaryToolbarStrip}>
        <div style={sectionHint}>
          <span style={pill}>toolbarBelow</span>
          <span style={dotSeparator}>&middot;</span>
          Filter chips, breadcrumbs, secondary actions
        </div>
      </div>

      {/* Middle: Sidebar + Grid */}
      <div style={middleRow}>
        <div style={sidebarCell}>
          <div style={sectionLabel}>Sidebar</div>
          <div style={sectionHint}>Columns panel</div>
          <div style={sectionHint}>Filters panel</div>
        </div>
        <div style={gridCell}>
          <div style={sectionLabel}>Data Grid</div>
          <div style={sectionHint}>
            Column headers, rows, inline editing
          </div>
          <div style={statusBarArea}>
            Status Bar &mdash; row count, aggregations
          </div>
        </div>
      </div>

      {/* Footer Strip */}
      <div style={footerStrip}>
        <div style={sectionLabel}>Footer Strip</div>
        <div style={sectionHint}>Pagination controls</div>
      </div>
    </div>
  );
}
