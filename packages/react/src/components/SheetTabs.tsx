/**
 * SheetTabs — Excel-style sheet tab bar at the bottom of the grid.
 *
 * Layout: [+] [Sheet1] [Sheet2] [Sheet3]
 */

import * as React from 'react';
import { useCallback } from 'react';
import type { ISheetDef } from '@alaarab/ogrid-core';

export interface SheetTabsProps {
  sheets: ISheetDef[];
  activeSheet: string;
  onSheetChange: (sheetId: string) => void;
  onSheetAdd?: () => void;
}

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  borderTop: '1px solid var(--ogrid-border, #e0e0e0)',
  background: 'var(--ogrid-header-bg, #f5f5f5)',
  minHeight: 30,
  overflowX: 'auto',
  overflowY: 'hidden',
  gap: 0,
  fontSize: 12,
};

const addBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 10px',
  fontSize: 16,
  lineHeight: '22px',
  color: 'var(--ogrid-fg-secondary, #666)',
  flexShrink: 0,
};

const tabBaseStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  padding: '4px 16px',
  fontSize: 12,
  lineHeight: '22px',
  color: 'var(--ogrid-fg, #242424)',
  whiteSpace: 'nowrap',
  position: 'relative',
};

const activeTabStyle: React.CSSProperties = {
  ...tabBaseStyle,
  fontWeight: 600,
  borderBottomColor: 'var(--ogrid-primary, #217346)',
  background: 'var(--ogrid-bg, #fff)',
};

export function SheetTabs({
  sheets,
  activeSheet,
  onSheetChange,
  onSheetAdd,
}: SheetTabsProps): React.ReactElement {
  const handleTabClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const id = e.currentTarget.dataset.sheetId;
      if (id) onSheetChange(id);
    },
    [onSheetChange]
  );

  return (
    <div style={barStyle} role="tablist" aria-label="Sheet tabs">
      {onSheetAdd && (
        <button
          type="button"
          style={addBtnStyle}
          onClick={onSheetAdd}
          title="Add sheet"
          aria-label="Add sheet"
        >
          +
        </button>
      )}
      {sheets.map((sheet) => {
        const isActive = sheet.id === activeSheet;
        const base = isActive ? activeTabStyle : tabBaseStyle;
        const style = sheet.color ? { ...base, borderBottomColor: sheet.color } : base;
        return (
          <button
            key={sheet.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            style={style}
            data-sheet-id={sheet.id}
            onClick={handleTabClick}
          >
            {sheet.name}
          </button>
        );
      })}
    </div>
  );
}
