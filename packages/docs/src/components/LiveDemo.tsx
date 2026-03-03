import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

interface LiveDemoProps {
  children: (() => React.ReactNode) | React.ReactNode;
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

function GridSkeleton({ height }: { height: number }) {
  return (
    <div className="live-demo__skeleton" style={{ height }}>
      {/* Header row */}
      <div className="live-demo__skeleton-header">
        {[30, 18, 22, 16, 14].map((w, i) => (
          <div key={i} className="live-demo__skeleton-cell live-demo__skeleton-cell--header" style={{ width: `${w}%` }} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: 8 }).map((_, row) => (
        <div key={row} className="live-demo__skeleton-row">
          {[30, 18, 22, 16, 14].map((w, col) => (
            <div key={col} className="live-demo__skeleton-cell" style={{ width: `${w}%`, opacity: 1 - row * 0.08 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LiveDemo({ children, height = 420, title }: LiveDemoProps) {
  const contentHeight = height - HEADER_HEIGHT;
  // Support both render-function and pre-evaluated ReactNode children.
  // Render-function form defers OGrid instantiation until BrowserOnly fires
  // on the client, preventing SSR from evaluating browser-only JSX.
  const renderFn: () => React.ReactNode =
    typeof children === 'function' ? children : () => children;

  return (
    <div className="live-demo" style={{ height, contain: 'layout style', minHeight: height }}>
      <div style={headerStyle}>
        <span style={titleStyle}>{title ?? ''}</span>
        <div className="live-demo__actions">
          <span className="live-demo__badge">Live</span>
        </div>
      </div>
      <div className="live-demo__content" style={{ height: contentHeight }}>
        <BrowserOnly fallback={<GridSkeleton height={contentHeight} />}>
          {renderFn}
        </BrowserOnly>
      </div>
    </div>
  );
}
