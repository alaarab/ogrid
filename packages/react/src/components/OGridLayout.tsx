/**
 * Single layout structure for OGrid: unified bordered container with
 * toolbar strip, grid area (optionally with sidebar), and footer strip.
 */

import * as React from 'react';
import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { SideBar } from './SideBar';
import type { SideBarProps } from './SideBar';
import { GRID_BORDER_RADIUS } from '@alaarab/ogrid-core';

export interface OGridLayoutProps {
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
  /** Controlled fullscreen state. Leave undefined to let the grid keep it. */
  isFullScreen?: boolean;
  /** Called when the toggle button or Escape asks to enter or leave fullscreen. */
  onFullScreenChange?: (isFullScreen: boolean) => void;
  /** Formula bar element (rendered between toolbar and grid). */
  formulaBar?: React.ReactNode;
  /** Sheet tabs element (rendered between grid and footer). */
  sheetTabs?: React.ReactNode;
}

// Stable style objects (avoid re-creating on every render)
const borderedContainerStyle: React.CSSProperties = {
  border: '1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12))',
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
  // A max-height on the grid shrinks the grid body, never the toolbar.
  flexShrink: 0,
};

/** Toolbar strip with border-bottom (when it's the only toolbar row). */
const toolbarStripStyle: React.CSSProperties = {
  ...toolbarStripBase,
  borderBottom: '1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12))',
};

/** Toolbar strip without border-bottom (when toolbarBelow follows  -  it owns the border). */
const toolbarStripNoBorderStyle: React.CSSProperties = toolbarStripBase;

/**
 * Toolbar strip when it carries ONLY built-in end items (the column
 * chooser / fullscreen button) and no custom `toolbar` or `toolbarBelow`
 * content. Keep it borderless and tight (a lone right-aligned control
 * doesn't warrant a full padded, bordered row), but KEEP the header
 * background so it reads as the top of the grid's header band — flush with
 * the column-header row below and consistent with the (also header-coloured)
 * footer strip. A transparent background here showed the white grid body
 * through the strip, producing a jarring white band above the beige header.
 */
const toolbarStripEndOnlyStyle: React.CSSProperties = {
  ...toolbarStripBase,
  padding: '4px 6px 2px',
};

const toolbarSectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

/** Secondary toolbar row (e.g. active filter chips). Matches toolbar strip styling. */
const toolbarBelowStyle: React.CSSProperties = {
  flexShrink: 0,
  borderBottom: '1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12))',
  padding: '6px 12px',
  background: 'var(--ogrid-header-bg, #f5f5f5)',
};

const footerStripStyle: React.CSSProperties = {
  flexShrink: 0,
  borderTop: '1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12))',
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
  ['--ogrid-virtual-scroll-min-height' as string]: '0px',
  width: '100%',
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
};

const gridChildStyle: React.CSSProperties = {
  ['--ogrid-virtual-scroll-min-height' as string]: '0px',
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
  zIndex: 'var(--ogrid-z-fullscreen, 9999)',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--ogrid-bg, #fff)',
};

const fullscreenBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12))',
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
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="10 2 14 2 14 6" />
    <polyline points="6 14 2 14 2 10" />
    <line x1="14" y1="2" x2="10" y2="6" />
    <line x1="2" y1="14" x2="6" y2="10" />
  </svg>
);

// SVG collapse icon (exit fullscreen): the expand icon's arrows turned inward,
// kept inside the same 2-14 box so no stroke touches the viewBox edge.
const CollapseIcon = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2 10 6 10 6 14" />
    <polyline points="14 6 10 6 10 2" />
    <line x1="2" y1="14" x2="6" y2="10" />
    <line x1="14" y1="2" x2="10" y2="6" />
  </svg>
);

/** Focus inside these means Escape belongs to them (text entry, popovers, menus), not full screen. */
const ESCAPE_OWNER_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"]';

interface PageScroll { x: number; y: number }

/**
 * Locks page scroll while a grid covers the viewport and returns the release.
 * The grid leaves the page flow, so the page can get shorter and the browser
 * clamps its scroll; the release puts back `scroll`, read before that happened.
 */
function lockPageScroll(scroll: PageScroll): () => void {
  const html = document.documentElement;
  const body = document.body;
  const prevHtmlOverflow = html.style.overflow;
  const prevBodyOverflow = body.style.overflow;
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  return () => {
    html.style.overflow = prevHtmlOverflow;
    body.style.overflow = prevBodyOverflow;
    window.scrollTo(scroll.x, scroll.y);
  };
}

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
    isFullScreen: controlledFullScreen,
    onFullScreenChange,
  } = props;

  const [internalFullScreen, setInternalFullScreen] = useState(false);
  const isFullScreen = controlledFullScreen ?? internalFullScreen;
  const isFullScreenRef = useRef(isFullScreen);
  isFullScreenRef.current = isFullScreen;
  const isControlled = controlledFullScreen !== undefined;
  const onFullScreenChangeRef = useRef(onFullScreenChange);
  onFullScreenChangeRef.current = onFullScreenChange;

  const setIsFullScreen = useCallback((next: boolean) => {
    if (next === isFullScreenRef.current) return;
    isFullScreenRef.current = next;
    if (!isControlled) setInternalFullScreen(next);
    onFullScreenChangeRef.current?.(next);
  }, [isControlled]);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(!isFullScreenRef.current);
  }, [setIsFullScreen]);

  // Lock the page behind the overlay. Released after the grid is back in the
  // page flow (not in a cleanup, which can run before that), so the restored
  // scroll position isn't clamped by a shorter page.
  const releaseScrollLockRef = useRef<(() => void) | null>(null);
  // Read during the render that enters fullscreen: by the layout effect the
  // grid is already fixed and the browser has clamped the page scroll.
  const pageScrollRef = useRef<PageScroll>({ x: 0, y: 0 });
  if (isFullScreen && !releaseScrollLockRef.current && typeof window !== 'undefined') {
    pageScrollRef.current = { x: window.scrollX, y: window.scrollY };
  }
  useLayoutEffect(() => {
    if (isFullScreen) {
      if (!releaseScrollLockRef.current) releaseScrollLockRef.current = lockPageScroll(pageScrollRef.current);
    } else if (releaseScrollLockRef.current) {
      releaseScrollLockRef.current();
      releaseScrollLockRef.current = null;
    }
  }, [isFullScreen]);
  useEffect(() => () => {
    releaseScrollLockRef.current?.();
    releaseScrollLockRef.current = null;
  }, []);

  // ESC key to exit fullscreen
  useEffect(() => {
    if (!isFullScreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Leave Escape to whatever already handled it (grid clearing its selection,
      // a popover or menu closing, an editor cancelling).
      if (e.defaultPrevented) return;
      const target = e.target as Element | null;
      if (target?.closest?.(ESCAPE_OWNER_SELECTOR)) return;
      setIsFullScreen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen, setIsFullScreen]);

  const hasSideBar = sideBar != null;
  const sideBarPosition = sideBar?.position ?? 'right';
  const hasToolbar = toolbar != null || toolbarEnd != null || fullScreen;
  // Only built-in end items (column chooser / fullscreen) present — no
  // custom toolbar or secondary row. Render a light, borderless strip
  // instead of a full empty bar (see toolbarStripEndOnlyStyle).
  const endItemsOnly =
    hasToolbar && toolbar == null && toolbarBelow == null;

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
    <div
      className={className}
      style={isFullScreen ? fullscreenRootStyle : rootStyle}
    >
      {/* === Bordered container === */}
      <div style={isFullScreen ? fullscreenContainerStyle : borderedContainerStyle}>
        {/* Toolbar strip */}
        {hasToolbar && (
          <div
            style={
              endItemsOnly
                ? toolbarStripEndOnlyStyle
                : toolbarBelow
                  ? toolbarStripNoBorderStyle
                  : toolbarStripStyle
            }
          >
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
    </div>
  );
}
