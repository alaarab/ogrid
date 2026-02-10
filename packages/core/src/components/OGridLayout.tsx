/**
 * Single layout structure for OGrid: unified bordered container with
 * toolbar strip, grid area (optionally with sidebar), and footer strip.
 * UI packages supply Container (Fluent/Radix: div, Material: Box).
 */

import * as React from 'react';
import { SideBar } from './SideBar';
import type { SideBarProps } from './SideBar';

export interface OGridLayoutProps {
  /** Root container element (default: 'div'). Material can pass Box. */
  containerComponent?: React.ElementType;
  /** Extra props for the root container (e.g. sx for MUI Box). */
  containerProps?: Record<string, unknown>;
  className?: string;
  /** Custom toolbar content (left-aligned in toolbar strip). */
  toolbar?: React.ReactNode;
  /** Built-in toolbar items rendered on the right side (column chooser, etc.). */
  toolbarEnd?: React.ReactNode;
  /** Grid content (DataGridTable). */
  children: React.ReactNode;
  /** Pagination controls (rendered in footer strip inside the bordered container). */
  pagination?: React.ReactNode;
  /** Side bar props. When provided, renders SideBar alongside the grid. */
  sideBar?: SideBarProps | null;
}

// Stable style objects (avoid re-creating on every render)
const borderedContainerStyle: React.CSSProperties = {
  border: '1px solid var(--ogrid-border, #e0e0e0)',
  borderRadius: 6,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  background: 'var(--ogrid-bg, #fff)',
};

const toolbarStripStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 12px',
  borderBottom: '1px solid var(--ogrid-border, #e0e0e0)',
  background: 'var(--ogrid-header-bg, #f5f5f5)',
  gap: 8,
  flexWrap: 'wrap',
  minHeight: 0,
};

const toolbarSectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const footerStripStyle: React.CSSProperties = {
  borderTop: '1px solid var(--ogrid-border, #e0e0e0)',
  background: 'var(--ogrid-header-bg, #f5f5f5)',
  padding: '6px 12px',
};

const gridAreaFlexStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  display: 'flex',
};

const gridAreaSoloStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
};

const gridChildStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
};

/**
 * Renders OGrid layout as a unified bordered container:
 *   ┌────────────────────────────────────┐
 *   │ [toolbar strip]                    │
 *   ├────────────────────────────────────┤
 *   │ [sidebar]? [grid]                  │
 *   ├────────────────────────────────────┤
 *   │ [footer strip / pagination]        │
 *   └────────────────────────────────────┘
 */
export function OGridLayout(props: OGridLayoutProps): React.ReactElement {
  const {
    containerComponent: Container = 'div',
    containerProps = {},
    className,
    toolbar,
    toolbarEnd,
    children,
    pagination,
    sideBar,
  } = props;

  const hasSideBar = sideBar != null;
  const sideBarPosition = sideBar?.position ?? 'right';
  const hasToolbar = toolbar != null || toolbarEnd != null;

  const rootStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  };

  return (
    <Container
      className={className}
      style={rootStyle}
      {...containerProps}
    >
      {/* === Bordered container === */}
      <div style={borderedContainerStyle}>
        {/* Toolbar strip */}
        {hasToolbar && (
          <div style={toolbarStripStyle}>
            <div style={toolbarSectionStyle}>{toolbar}</div>
            <div style={toolbarSectionStyle}>{toolbarEnd}</div>
          </div>
        )}

        {/* Grid area (with optional sidebar) */}
        {hasSideBar ? (
          <div style={gridAreaFlexStyle}>
            {sideBarPosition === 'left' && <SideBar {...sideBar} />}
            <div style={gridChildStyle}>{children}</div>
            {sideBarPosition !== 'left' && <SideBar {...sideBar} />}
          </div>
        ) : (
          <div style={gridAreaSoloStyle}>{children}</div>
        )}

        {/* Footer strip (pagination) */}
        {pagination && (
          <div style={footerStripStyle}>{pagination}</div>
        )}
      </div>
    </Container>
  );
}
