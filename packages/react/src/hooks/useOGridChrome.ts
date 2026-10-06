import * as React from 'react';
import { useMemo } from 'react';
import { SheetTabs } from '../components/SheetTabs';
import type { SideBarProps } from '../components/SideBar';
import type { IOGridProps } from '../types';
import type { UseOGridLayout } from './useOGrid.types';

/** Inline style for the name box (active cell reference display). */
const NAME_BOX_STYLE: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '12px',
  fontWeight: 500,
  padding: '2px 8px',
  border: '1px solid var(--ogrid-border, #e0e0e0)',
  borderRadius: 3,
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
  minWidth: 48,
  textAlign: 'center',
  lineHeight: '20px',
  userSelect: 'none',
  display: 'block',
};

/** Toolbar (with the name box), sheet tabs and the rest of the layout chrome around the grid. */
export function useOGridChrome<T>(
  props: Pick<
    IOGridProps<T>,
    'toolbar' | 'toolbarBelow' | 'className' | 'emptyState' | 'fullScreen' | 'sheetDefs' | 'activeSheet' | 'onSheetChange' | 'onSheetAdd'
  >,
  showNameBox: boolean,
  activeCellRef: string | null,
  sideBarProps: SideBarProps | null,
  formulaBar: React.ReactNode,
): UseOGridLayout {
  const { toolbar, toolbarBelow, className, emptyState, fullScreen, sheetDefs, activeSheet, onSheetChange, onSheetAdd } = props;

  const nameBoxEl = useMemo(() => showNameBox ? React.createElement('output', {
    style: NAME_BOX_STYLE,
    'aria-label': 'Active cell reference',
  }, activeCellRef ?? '—') : null, [showNameBox, activeCellRef]);

  const resolvedToolbar = useMemo(() => showNameBox
    ? React.createElement(React.Fragment, null, nameBoxEl, toolbar)
    : toolbar, [showNameBox, nameBoxEl, toolbar]);

  // Sheet tabs element (only when sheetDefs are provided)
  const sheetTabsEl = useMemo(() => {
    if (!sheetDefs || sheetDefs.length === 0 || !activeSheet || !onSheetChange) return undefined;
    return React.createElement(SheetTabs, {
      sheets: sheetDefs,
      activeSheet,
      onSheetChange,
      onSheetAdd,
    });
  }, [sheetDefs, activeSheet, onSheetChange, onSheetAdd]);

  return useMemo<UseOGridLayout>(() => ({
    toolbar: resolvedToolbar,
    toolbarBelow,
    className,
    emptyState,
    sideBarProps,
    fullScreen,
    formulaBar,
    sheetTabs: sheetTabsEl,
  }), [resolvedToolbar, toolbarBelow, className, emptyState, sideBarProps, fullScreen, formulaBar, sheetTabsEl]);
}
