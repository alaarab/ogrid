import * as React from 'react';
import { getHeaderFilterConfig } from '../utils';
import { getColumnHeaderMenuProps } from '../hooks/useColumnHeaderMenuState';
import { useDataGridTableOrchestration } from '../hooks/useDataGridTableOrchestration';
import type { InlineCellEditorProps } from './createOGrid';

/**
 * CSS-module class names the shared table body needs. Adapters scope their own
 * `.module.scss` differently (e.g. `selectionCell` vs `selectionCellWrapper`),
 * so the consumer maps its module to this normalized shape.
 */
export interface DataGridStyles {
  selectedRow: string;
  selectionCell: string;
  selectionCellInner: string;
  rowNumberCell: string;
  rowNumberCellInner: string;
  tableWrapper: string;
  selectableGrid: string;
  tableScrollContent: string;
  loadingDimmed: string;
  tableWidthAnchor: string;
  dataTable: string;
  stickyHeader: string;
  columnLetterRow?: string;
  columnLetterCell: string;
  selectionHeaderCell: string;
  selectionHeaderCellInner: string;
  rowNumberHeaderCell: string;
  rowNumberHeaderCellInner: string;
  resizeHandle: string;
  groupHeaderCell: string;
  headerCellContent: string;
  headerMenuTrigger: string;
  editingCellContent: string;
  cellContent: string;
  activeCellContent: string;
  inRange: string;
  cellInRange: string;
  cellCut: string;
  cellCopied: string;
  fillHandle: string;
  // Index signature so adapters can pass their full module without listing every key.
  [key: string]: string | undefined;
}

/** Props passed to an adapter's row-checkbox renderer. */
export interface RowCheckboxRenderProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
}

/** Props passed to an adapter's header select-all renderer. */
export interface HeaderSelectAllRenderProps {
  allSelected: boolean;
  someSelected: boolean;
  onChange: (checked: boolean) => void;
}

/** Props passed to an adapter's boolean-cell renderer. */
export interface BooleanCellRenderProps {
  checked: boolean;
  disabled: boolean;
  onChange: (() => void) | undefined;
  onPointerDown: (e: React.PointerEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
}

/** Props passed to an adapter's popover-editor renderer. */
export interface PopoverEditorRenderProps {
  open: boolean;
  onClose: () => void;
  setAnchorEl: (el: HTMLElement) => void;
  anchorEl: HTMLElement | null;
  /** The display content to render inside the popover anchor. */
  anchorContent: React.ReactNode;
  /** The editor element to render in the popover surface/content. */
  editor: React.ReactNode;
}

/**
 * UI primitives an adapter (Radix / Fluent) injects to bind its component
 * library to the shared data-grid body. Element wrappers (`TableEl`, `Tr`,
 * `Td`, …) cover the structural DOM, render-props cover the interactive bits
 * (checkboxes, popovers) that have library-specific markup.
 */
export interface DataGridPrimitives {
  TableEl: React.ElementType;
  Thead: React.ElementType;
  Tbody: React.ElementType;
  Tr: React.ElementType;
  Td: React.ElementType;
  Th: React.ElementType;
  /** Pass `true` to make `useColumnMeta` inline `position: sticky` (Fluent). */
  addStickyPosition?: boolean;
  /**
   * Pass `true` to omit `rowSpan` on leaf header cells (`Th`). Fluent's
   * `TableHeaderCell` doesn't support rowSpan, so it relied on native `<th>` for
   * grouped headers and never applied a rowSpan to leaf cells.
   */
  omitLeafRowSpan?: boolean;
  /**
   * Pass `true` to use the delegated (stable, zero-per-cell-closure) cell
   * interaction handlers. Radix opts in; Fluent uses the per-cell-closure
   * fallback path (it never passed delegated handlers historically).
   */
  useDelegatedCellHandlers?: boolean;
  /** Resolve the portal target for the context menu. Defaults to document.body. */
  getContextMenuPortalTarget?: (wrapper: HTMLElement | null) => HTMLElement;
  renderRowCheckbox: (p: RowCheckboxRenderProps) => React.ReactNode;
  renderHeaderSelectAll: (p: HeaderSelectAllRenderProps) => React.ReactNode;
  renderBooleanCell: (p: BooleanCellRenderProps) => React.ReactNode;
  renderPopoverEditor: (p: PopoverEditorRenderProps) => React.ReactNode;
  /** Inline editor component (adapter-specific subclass of BaseInlineCellEditor). */
  InlineCellEditor: <T>(p: InlineCellEditorProps<T>) => React.ReactElement;
  /** Column header filter component. */
  ColumnHeaderFilter: React.ComponentType<ReturnType<typeof getHeaderFilterConfig>>;
  /** Column header options menu component. */
  ColumnHeaderMenu: React.ComponentType<ReturnType<typeof getColumnHeaderMenuProps>>;
  /** Context menu component. */
  GridContextMenu: React.ComponentType<{
    x: number; y: number; hasSelection: boolean;
    canUndo: boolean; canRedo: boolean;
    onUndo: () => void; onRedo: () => void;
    onCopy: () => void; onCut: () => void; onPaste: () => void;
    onSelectAll: () => void; onClose: () => void;
  }>;
  /** Empty-state component. */
  EmptyState: React.ComponentType<{ emptyState: NonNullable<ReturnType<typeof useDataGridTableOrchestration>['emptyState']> }>;
  /** Loading overlay component. */
  LoadingOverlay: React.ComponentType<{ message: string }>;
  /** Drop indicator overlay component. */
  DropIndicator: React.ComponentType<{ dropIndicatorX: number; wrapperLeft: number }>;
  /** Status bar component. */
  StatusBar: React.ComponentType<{
    totalCount: number; filteredCount?: number; selectedCount?: number;
    selectedCellCount?: number;
    aggregation?: import('./StatusBar').StatusBarProps['aggregation'];
    suppressRowCount?: boolean;
  }>;
}
