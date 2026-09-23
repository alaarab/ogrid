
import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
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
  usePortalTheme,
} from '@alaarab/ogrid-react';
import type { DataGridStyles, DataGridPrimitives, PopoverEditorRenderProps } from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';

// Radix binds native table elements + Radix Checkbox/Popover to the shared
// DataGridTable body in @alaarab/ogrid-react. Only the UI-primitive wrappers and
// the scoped CSS module differ from the Fluent adapter.

const primitives: DataGridPrimitives = {
  TableEl: 'table',
  Thead: 'thead',
  Tbody: 'tbody',
  Tr: 'tr',
  Td: 'td',
  Th: 'th',
  // Radix uses the delegated (zero-per-cell-closure) interaction handlers.
  useDelegatedCellHandlers: true,
  InlineCellEditor: InlineCellEditor as DataGridPrimitives['InlineCellEditor'],
  ColumnHeaderFilter,
  ColumnHeaderMenu,
  GridContextMenu,
  EmptyState,
  LoadingOverlay,
  DropIndicator,
  StatusBar,
  renderRowCheckbox: ({ checked, onCheckedChange, ariaLabel }) => (
    <Checkbox.Root
      className={styles.rowCheckbox}
      checked={checked}
      onCheckedChange={(c: boolean | 'indeterminate') => onCheckedChange(!!c)}
      aria-label={ariaLabel}
    >
      <Checkbox.Indicator className={styles.rowCheckboxIndicator}>✓</Checkbox.Indicator>
    </Checkbox.Root>
  ),
  renderHeaderSelectAll: ({ allSelected, someSelected, onChange }) => (
    <Checkbox.Root
      className={styles.rowCheckbox}
      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
      onCheckedChange={(c: boolean | 'indeterminate') => onChange(!!c)}
      aria-label="Select all rows"
    >
      <Checkbox.Indicator className={styles.rowCheckboxIndicator}>
        {someSelected && !allSelected ? '–' : '✓'}
      </Checkbox.Indicator>
    </Checkbox.Root>
  ),
  renderBooleanCell: ({ checked, disabled, onChange, onPointerDown, onClick, ariaLabel }) => (
    <Checkbox.Root
      className={styles.rowCheckbox}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange ? () => onChange() : undefined}
      onPointerDown={onPointerDown}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <Checkbox.Indicator className={styles.rowCheckboxIndicator}>✓</Checkbox.Indicator>
    </Checkbox.Root>
  ),
  renderPopoverEditor: (p) => <RadixPopoverEditor {...p} />,
};

/** Popover cell editor; copies the grid's scoped theme tokens into the portal. */
function RadixPopoverEditor({ open, onClose, setAnchorEl, anchorContent, editor }: PopoverEditorRenderProps) {
  const anchorRef = React.useRef<HTMLDivElement | null>(null);
  const portalTheme = usePortalTheme(anchorRef, open);
  return (
    <Popover.Root open={open} onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
      <Popover.Anchor asChild>
        <div
          ref={(el: HTMLDivElement | null) => {
            anchorRef.current = el;
            if (el) setAnchorEl(el);
          }}
          className="ogrid-popover-anchor"
          style={POPOVER_ANCHOR_STYLE}
        >
          {anchorContent}
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content sideOffset={4} style={portalTheme} onOpenAutoFocus={(e: Event) => e.preventDefault()}>
          {editor}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export const DataGridTable = createDataGridTable(styles as DataGridStyles, primitives);
