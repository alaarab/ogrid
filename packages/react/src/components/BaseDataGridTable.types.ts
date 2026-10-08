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

/** Props passed to an adapter's Find & Replace panel. */
export interface FindReplacePanelProps {
  /** Headless find state (query, options, matches, next/prev, replace). */
  find: import('../hooks/useFindReplace').UseFindReplaceResult;
  /** Close the panel and return focus to the grid. */
  onClose: () => void;
  /** Bumped on every Ctrl+F / Ctrl+H; focus and select the find input when it changes. */
  focusRequest: number;
}

/** Props passed to an adapter's cell-note popover renderer. */
export interface CellNotePopoverRenderProps {
  /** Always true while rendered; the shared body unmounts the popover when it closes. */
  open: boolean;
  /** The noted cell (`<td>`) the popover points at. */
  anchorEl: HTMLElement;
  /**
   * `view` shows the note (hover/focus) and must not take focus; `edit` holds
   * the note editor, which focuses its own textarea.
   */
  mode: 'view' | 'edit';
  /** Pointer down outside the popover: the editor saves, the viewer closes. */
  onDismiss: () => void;
  /** Escape: the editor discards its changes, the viewer closes. */
  onEscape: () => void;
  /** Note viewer or editor, rendered inside the popover surface. */
  content: React.ReactNode;
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
   * interaction handlers. Both built-in kits opt in; omit it to fall back to
   * per-cell closures.
   */
  useDelegatedCellHandlers?: boolean;
  /** Resolve the portal target for the context menu. Defaults to document.body. */
  getContextMenuPortalTarget?: (wrapper: HTMLElement | null) => HTMLElement;
  renderRowCheckbox: (p: RowCheckboxRenderProps) => React.ReactNode;
  renderHeaderSelectAll: (p: HeaderSelectAllRenderProps) => React.ReactNode;
  renderBooleanCell: (p: BooleanCellRenderProps) => React.ReactNode;
  renderPopoverEditor: (p: PopoverEditorRenderProps) => React.ReactNode;
  /** Cell-note popover (Radix Popover / Fluent Popover). Without it notes open in a plain fixed-position box. */
  renderCellNotePopover?: (p: CellNotePopoverRenderProps) => React.ReactNode;
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
    onPasteValues?: () => void;
    onSelectAll: () => void; onClose: () => void;
    structure?: import('./GridContextMenu').GridContextMenuStructure;
    hiding?: import('./GridContextMenu').GridContextMenuHiding;
    freeze?: import('./GridContextMenu').GridContextMenuFreeze;
    notes?: import('./GridContextMenu').GridContextMenuNotes;
    onDataValidation?: () => void;
  }>;
  /** Empty-state component. */
  EmptyState: React.ComponentType<{ emptyState: NonNullable<ReturnType<typeof useDataGridTableOrchestration>['emptyState']> }>;
  /** Loading overlay component. */
  LoadingOverlay: React.ComponentType<{ message: string }>;
  /** Drop indicator overlay component. */
  DropIndicator: React.ComponentType<{ dropIndicatorX: number; wrapperLeft: number }>;
  /** Find & Replace panel (rendered at the grid's top-right when `findReplace` is on). */
  FindReplacePanel?: React.ComponentType<FindReplacePanelProps>;
  /** Lazy-loaded adapter dialog: settings editor and validation alerts. */
  ValidationDialog?: React.ComponentType<DataValidationDialogProps>;
  /** Status bar component. */
  StatusBar: React.ComponentType<{
    totalCount: number; filteredCount?: number; selectedCount?: number;
    selectedCellCount?: number;
    aggregation?: import('./StatusBar').StatusBarProps['aggregation'];
    suppressRowCount?: boolean;
    panels?: import('./StatusBar').StatusBarProps['panels'];
  }>;
}

export interface DataValidationDialogProps {
  /** Preserve grid-scoped theme tokens on the modal portal. */
  theme?: React.CSSProperties;
  formulaOffset?: { col: number; row: number };
  rule?: import('@alaarab/ogrid-core').IDataValidationRule;
  alert?: import('@alaarab/ogrid-core').IDataValidationFailure | null;
  onApply: (rule: import('@alaarab/ogrid-core').IDataValidationRule | undefined) => void;
  onClose: () => void;
  onRespond: (accept: boolean) => void;
}
