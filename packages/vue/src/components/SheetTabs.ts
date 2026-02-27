/**
 * SheetTabs — Excel-style sheet tab bar at the bottom of the grid.
 *
 * Layout: [+] [Sheet1] [Sheet2] [Sheet3]
 */

import { defineComponent, h, type PropType } from 'vue';
import type { ISheetDef } from '@alaarab/ogrid-core';

export interface SheetTabsProps {
  sheets: ISheetDef[];
  activeSheet: string;
}

const barStyle = {
  display: 'flex',
  alignItems: 'center',
  borderTop: '1px solid var(--ogrid-border, #e0e0e0)',
  background: 'var(--ogrid-header-bg, #f5f5f5)',
  minHeight: '30px',
  overflowX: 'auto',
  overflowY: 'hidden',
  gap: '0',
  fontSize: '12px',
} as const;

const addBtnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 10px',
  fontSize: '16px',
  lineHeight: '22px',
  color: 'var(--ogrid-fg-secondary, #666)',
  flexShrink: 0,
} as const;

const tabBaseStyle = {
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  padding: '4px 16px',
  fontSize: '12px',
  lineHeight: '22px',
  color: 'var(--ogrid-fg, #242424)',
  whiteSpace: 'nowrap',
  position: 'relative',
} as const;

const activeTabStyle = {
  ...tabBaseStyle,
  fontWeight: 600,
  borderBottomColor: 'var(--ogrid-primary, #217346)',
  background: 'var(--ogrid-bg, #fff)',
} as const;

export const SheetTabs = defineComponent({
  name: 'SheetTabs',
  props: {
    sheets: { type: Array as PropType<ISheetDef[]>, required: true },
    activeSheet: { type: String, required: true },
    showAddButton: { type: Boolean, default: false },
  },
  emits: ['sheetChange', 'sheetAdd'],
  setup(props, { emit }) {
    return () =>
      h('div', { style: barStyle, role: 'tablist', 'aria-label': 'Sheet tabs' }, [
        props.showAddButton
          ? h('button', {
              type: 'button',
              style: addBtnStyle,
              onClick: () => emit('sheetAdd'),
              title: 'Add sheet',
              'aria-label': 'Add sheet',
            }, '+')
          : null,
        ...props.sheets.map((sheet) => {
          const isActive = sheet.id === props.activeSheet;
          const base = isActive ? activeTabStyle : tabBaseStyle;
          const style = isActive && sheet.color ? { ...base, borderBottomColor: sheet.color } : base;
          return h('button', {
            key: sheet.id,
            type: 'button',
            role: 'tab',
            'aria-selected': isActive,
            style,
            onClick: () => emit('sheetChange', sheet.id),
          }, sheet.name);
        }),
      ]);
  },
});
