import * as React from 'react';
import { useMemo } from 'react';
import { SheetTabs } from '../components/SheetTabs';
import { NameBox } from '../components/NameBox';
import { QuickFilterBox } from '../components/QuickFilterBox';
import type { UseOGridNameBoxResult } from './useOGridNameBox';
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
  display: 'block',
};

/** Toolbar (with the name box), sheet tabs and the rest of the layout chrome around the grid. */
export function useOGridChrome<T>(
  props: Pick<
    IOGridProps<T>,
    'toolbar' | 'toolbarBelow' | 'className' | 'emptyState' | 'fullScreen' | 'isFullScreen' | 'onFullScreenChange' | 'sheetDefs' | 'activeSheet' | 'onSheetChange' | 'onSheetAdd'
    | 'onSheetRename' | 'onSheetReorder' | 'onSheetDelete' | 'onSheetColorChange' | 'quickFilterBox'
  >,
  showNameBox: boolean,
  activeCellRef: string | null,
  sideBarProps: SideBarProps | null,
  formulaBar: React.ReactNode,
  nameBox?: Pick<UseOGridNameBoxResult, 'navigate' | 'returnFocus'>,
  quickFilter?: { quickFilter: string; setQuickFilter: (text: string) => void },
): UseOGridLayout {
  const { toolbar, toolbarBelow, className, emptyState, fullScreen, sheetDefs, activeSheet, onSheetChange, onSheetAdd } = props;
  const { onSheetRename, onSheetReorder, onSheetDelete, onSheetColorChange, isFullScreen, onFullScreenChange } = props;

  const navigate = nameBox?.navigate;
  const returnFocus = nameBox?.returnFocus;
  const nameBoxEl = useMemo(() => showNameBox ? React.createElement(NameBox, {
    style: NAME_BOX_STYLE,
    cellRef: activeCellRef,
    onNavigate: navigate,
    onCancel: returnFocus,
  }) : null, [showNameBox, activeCellRef, navigate, returnFocus]);

  const { quickFilterBox } = props;
  const boxOptions = typeof quickFilterBox === 'object' ? quickFilterBox : undefined;
  const quickFilterText = quickFilter?.quickFilter ?? '';
  const setQuickFilter = quickFilter?.setQuickFilter;
  const quickFilterEl = useMemo(() => quickFilterBox && setQuickFilter ? React.createElement(QuickFilterBox, {
    value: quickFilterText,
    onChange: setQuickFilter,
    placeholder: boxOptions?.placeholder,
    ariaLabel: boxOptions?.ariaLabel,
  }) : null, [quickFilterBox, quickFilterText, setQuickFilter, boxOptions?.placeholder, boxOptions?.ariaLabel]);

  const resolvedToolbar = useMemo(() => showNameBox || quickFilterEl
    ? React.createElement(React.Fragment, null, nameBoxEl, quickFilterEl, toolbar)
    : toolbar, [showNameBox, nameBoxEl, quickFilterEl, toolbar]);

  // Sheet tabs element (only when sheetDefs are provided)
  const sheetTabsEl = useMemo(() => {
    if (!sheetDefs || sheetDefs.length === 0 || !activeSheet || !onSheetChange) return undefined;
    return React.createElement(SheetTabs, {
      sheets: sheetDefs,
      activeSheet,
      onSheetChange,
      onSheetAdd,
      onSheetRename,
      onSheetReorder,
      onSheetDelete,
      onSheetColorChange,
    });
  }, [sheetDefs, activeSheet, onSheetChange, onSheetAdd, onSheetRename, onSheetReorder, onSheetDelete, onSheetColorChange]);

  return useMemo<UseOGridLayout>(() => ({
    toolbar: resolvedToolbar,
    toolbarBelow,
    className,
    emptyState,
    sideBarProps,
    fullScreen,
    isFullScreen,
    onFullScreenChange,
    formulaBar,
    sheetTabs: sheetTabsEl,
  }), [resolvedToolbar, toolbarBelow, className, emptyState, sideBarProps, fullScreen, isFullScreen, onFullScreenChange, formulaBar, sheetTabsEl]);
}
