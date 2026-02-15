import React from 'react';

interface LiveDemoProps {
  children: React.ReactNode;
  height?: number;
  title?: string;
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 14px',
  borderBottom: '1px solid var(--ogrid-border-glass)',
  background: 'var(--ogrid-bg-subtle, #f5f5f5)',
};

const titleStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--ifm-color-emphasis-600)',
};

const HEADER_HEIGHT = 34;

export function LiveDemo({ children, height = 420, title }: LiveDemoProps) {
  return (
    <div className="live-demo" style={{ height }}>
      <div style={headerStyle}>
        <span style={titleStyle}>{title ?? ''}</span>
        <div className="live-demo__actions">
          <span className="live-demo__badge">Live</span>
        </div>
      </div>
      <div className="live-demo__content" style={{ height: height - HEADER_HEIGHT }}>
        {children}
      </div>
    </div>
  );
}
