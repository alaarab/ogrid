import * as React from 'react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Checkbox,
  Popover,
  PopoverSurface,
  type OpenPopoverEvents,
  type OnOpenChangeData,
} from '@fluentui/react-components';
import { ColumnHeaderFilter } from '../ColumnHeaderFilter';
import { ColumnHeaderMenu } from '../ColumnHeaderMenu';
import { InlineCellEditor } from './InlineCellEditor';
import { StatusBar } from './StatusBar';
import { GridContextMenu } from './GridContextMenu';
import { EmptyState } from './EmptyState';
import { LoadingOverlay } from './LoadingOverlay';
import { DropIndicator } from './DropIndicator';
import {
  createDataGridTable,
  POPOVER_ANCHOR_STYLE,
} from '@alaarab/ogrid-react';
import type { DataGridStyles, DataGridPrimitives } from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';

// Fluent binds @fluentui/react-components table elements + Checkbox/Popover to
// the shared DataGridTable body in @alaarab/ogrid-react. Only the UI-primitive
// wrappers and the scoped CSS module differ from the Radix adapter.

// Fluent's CSS module scopes cell classes under `*Wrapper` keys (e.g.
// `selectionCellWrapper`) where the shared body expects `selectionCell`. Remap
// so the shared component picks up Fluent's atomic class names.
const dataGridStyles: DataGridStyles = {
  ...(styles as Record<string, string>),
  selectionCell: styles.selectionCellWrapper,
  rowNumberCell: styles.rowNumberCellWrapper,
  selectionHeaderCell: styles.selectionHeaderCellWrapper,
  rowNumberHeaderCell: styles.rowNumberHeaderCellWrapper,
} as DataGridStyles;

const primitives: DataGridPrimitives = {
  TableEl: Table,
  Thead: TableHeader,
  Tbody: TableBody,
  Tr: TableRow,
  Td: TableCell,
  Th: TableHeaderCell,
  // Fluent UI's TableCell injects atomic `position: relative` via CSS-in-JS,
  // overriding the shared `.pinnedColLeft { position: sticky }` class. Inline
  // style wins over atomic CSS, so request the inline sticky override.
  addStickyPosition: true,
  // Fluent's TableHeaderCell doesn't support rowSpan.
  omitLeafRowSpan: true,
  getContextMenuPortalTarget: (wrapper) =>
    (wrapper?.closest('.fui-FluentProvider') as HTMLElement) ?? document.body,
  InlineCellEditor: InlineCellEditor as DataGridPrimitives['InlineCellEditor'],
  ColumnHeaderFilter,
  ColumnHeaderMenu,
  GridContextMenu,
  EmptyState,
  LoadingOverlay,
  DropIndicator,
  StatusBar,
  renderRowCheckbox: ({ checked, onCheckedChange, ariaLabel }) => (
    <Checkbox
      checked={checked}
      onChange={(_e, data) => onCheckedChange(!!data.checked)}
      aria-label={ariaLabel}
    />
  ),
  renderHeaderSelectAll: ({ allSelected, someSelected, onChange }) => (
    <Checkbox
      checked={allSelected ? true : someSelected ? 'mixed' : false}
      onChange={(_, data) => onChange(!!data.checked)}
      aria-label="Select all rows"
    />
  ),
  renderBooleanCell: ({ checked, disabled, onChange, onPointerDown, onClick, ariaLabel }) => (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange ? () => onChange() : undefined}
      onPointerDown={onPointerDown}
      onClick={onClick}
      className={styles.booleanCheckbox}
      aria-label={ariaLabel}
    />
  ),
  renderPopoverEditor: ({ open, onClose, setAnchorEl, anchorEl, anchorContent, editor }) => (
    <>
      <div
        ref={(el) => { if (el) setAnchorEl(el); }}
        style={POPOVER_ANCHOR_STYLE}
      >
        {anchorContent}
      </div>
      <Popover
        open={open}
        onOpenChange={(_: OpenPopoverEvents, data: OnOpenChangeData) => { if (!data.open) onClose(); }}
        positioning={{ target: anchorEl ?? undefined }}
      >
        <PopoverSurface>
          {editor}
        </PopoverSurface>
      </Popover>
    </>
  ),
};

export const DataGridTable = createDataGridTable(dataGridStyles, primitives);
