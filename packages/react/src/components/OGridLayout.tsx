/**
 * Single layout structure for OGrid: unified bordered container with
 * toolbar strip, grid area (optionally with sidebar), and footer strip.
 * UI packages supply Container (Fluent/Radix: div, Material: Box).
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { SideBar } from './SideBar';
import type { SideBarProps } from './SideBar';
import { GRID_BORDER_RADIUS } from '@alaarab/ogrid-core';

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
  /** Secondary toolbar row below the primary toolbar (e.g. active filter chips). Full width. */
  toolbarBelow?: React.ReactNode;
  /** Grid content (DataGridTable). */
  children: React.ReactNode;
  /** Pagination controls (rendered in footer strip inside the bordered container). */
  pagination?: React.ReactNode;
  /** Side bar props. When provided, renders SideBar alongside the grid. */
  sideBar?: SideBarProps | null;
  /** When true, render a fullscreen toggle button in the toolbar. */
  fullScreen?: boolean;
  /** Formula bar element (rendered between toolbar and grid). */
  formulaBar?: React.ReactNode;
  /** Sheet tabs element (rendered between grid and footer). */
  sheetTabs?: React.ReactNode;
}

// Stable style objects (avoid re-creating on every render)
const borderedContainerStyle: React.CSSProperties = {
  border: '1px solid var(--ogrid-border, #e0e0e0)',
  borderRadius: GRID_BORDER_RADIUS,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  background: 'var(--ogrid-bg, #fff)',
};

const fullscreenContainerStyle: React.CSSProperties = {
  ...borderedContainerStyle,
  borderRadius: 0,
  border: 'none',
};

const toolbarStripBase: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 12px',
  background: 'var(--ogrid-header-bg, #f5f5f5)',
  gap: 8,
  flexWrap: 'wrap',
  minHeight: 0,
};

/** Toolbar strip with border-bottom (when it's the only toolbar row). */
const toolbarStripStyle: React.CSSProperties = {
  ...toolbarStripBase,
  borderBottom: '1px solid var(--ogrid-border, #e0e0e0)',
};

/** Toolbar strip without border-bottom (when toolbarBelow follows — it owns the border). */
const toolbarStripNoBorderStyle: React.CSSProperties = toolbarStripBase;

const toolbarSectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

/** Secondary toolbar row (e.g. active filter chips). Matches toolbar strip styling. */
const toolbarBelowStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--ogrid-border, #e0e0e0)',
  padding: '6px 12px',
  background: 'var(--ogrid-header-bg, #f5f5f5)',
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

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};

const fullscreenRootStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--ogrid-bg, #fff)',
};

const fullscreenBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--ogrid-border, #e0e0e0)',
  borderRadius: 4,
  padding: '4px 6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ogrid-fg, #242424)',
};

// SVG expand icon (enter fullscreen)
const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="10 2 14 2 14 6" />
    <polyline points="6 14 2 14 2 10" />
    <line x1="14" y1="2" x2="10" y2="6" />
    <line x1="2" y1="14" x2="6" y2="10" />
  </svg>
);

// SVG collapse icon (exit fullscreen)
const CollapseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 10 0 10 0 14" />
    <polyline points="12 6 16 6 16 2" />
    <line x1="0" y1="10" x2="4" y2="6" />
    <line x1="16" y1="6" x2="12" y2="10" />
  </svg>
);

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
    toolbarBelow,
    children,
    pagination,
    sideBar,
    fullScreen,
    formulaBar,
    sheetTabs,
  } = props;

  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);

  // ESC key to exit fullscreen
  useEffect(() => {
    if (!isFullScreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullScreen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  const hasSideBar = sideBar != null;
  const sideBarPosition = sideBar?.position ?? 'right';
  const hasToolbar = toolbar != null || toolbarEnd != null || fullScreen;

  const fullscreenButton = fullScreen ? (
    <button
      type="button"
      style={fullscreenBtnStyle}
      onClick={toggleFullScreen}
      title={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}
      aria-label={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}
    >
      {isFullScreen ? <CollapseIcon /> : <ExpandIcon />}
    </button>
  ) : null;

  return (
    <Container
      className={className}
      style={isFullScreen ? fullscreenRootStyle : rootStyle}
      {...containerProps}
    >
      {/* === Bordered container === */}
      <div style={isFullScreen ? fullscreenContainerStyle : borderedContainerStyle}>
        {/* Toolbar strip */}
        {hasToolbar && (
          <div style={toolbarBelow ? toolbarStripNoBorderStyle : toolbarStripStyle}>
            <div style={toolbarSectionStyle}>{toolbar}</div>
            <div style={toolbarSectionStyle}>
              {toolbarEnd}
              {fullscreenButton}
            </div>
          </div>
        )}

        {/* Secondary toolbar row (filter chips, etc.) */}
        {toolbarBelow && (
          <div style={toolbarBelowStyle}>{toolbarBelow}</div>
        )}

        {/* Formula bar (between toolbar and grid) */}
        {formulaBar}

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

        {/* Sheet tabs (between grid and footer) */}
        {sheetTabs}

        {/* Footer strip (pagination) */}
        {pagination && (
          <div style={footerStripStyle}>{pagination}</div>
        )}
      </div>
    </Container>
  );
}
