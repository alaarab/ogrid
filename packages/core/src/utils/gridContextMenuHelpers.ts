/**
 * Shared definition for grid context menu items. Used by the Radix and Fluent GridContextMenu components.
 */
export interface GridContextMenuItem {
  id: string;
  label: string;
  /** Keyboard shortcut text displayed in the menu (e.g. 'Ctrl+Z'). Ctrl is swapped to ⌘ on Mac at render time. */
  shortcut?: string;
  /** When true, the item is disabled when there is no cell selection (e.g. Copy, Cut). */
  disabledWhenNoSelection?: boolean;
  /** When true, a divider is rendered before this item. */
  dividerBefore?: boolean;
}

export const GRID_CONTEXT_MENU_ITEMS: GridContextMenuItem[] = [
  { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y' },
  { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', disabledWhenNoSelection: true, dividerBefore: true },
  { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X', disabledWhenNoSelection: true },
  { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
  { id: 'selectAll', label: 'Select all', shortcut: 'Ctrl+A', dividerBefore: true },
];

/** Input for the structure-edit section of the grid context menu. */
export interface StructureMenuInput {
  /** Number of rows the action applies to (the selected rows); 0 hides the row items. */
  rowCount: number;
  /** Number of columns the action applies to (the selected columns); 0 hides the column items. */
  columnCount: number;
  /** Show the insert-row items (default true). */
  canInsertRows?: boolean;
  /** Show the delete-row item (default true). */
  canDeleteRows?: boolean;
}

/**
 * Context menu items for structure edits (opt-in via `allowStructureEdits`):
 * insert/delete rows and columns. Labels count the selected rows/columns,
 * the way spreadsheets do ("Insert 3 rows above").
 */
export function getStructureMenuItems(input: StructureMenuInput): GridContextMenuItem[] {
  const { rowCount, columnCount, canInsertRows = true, canDeleteRows = true } = input;
  const items: GridContextMenuItem[] = [];
  if (rowCount > 0) {
    const rows = rowCount === 1 ? 'row' : `${rowCount} rows`;
    const rowItems: GridContextMenuItem[] = [];
    if (canInsertRows) {
      rowItems.push(
        { id: 'insertRowAbove', label: `Insert ${rows} above` },
        { id: 'insertRowBelow', label: `Insert ${rows} below` },
      );
    }
    if (canDeleteRows) rowItems.push({ id: 'deleteRows', label: `Delete ${rows}` });
    const first = rowItems[0];
    if (first) rowItems[0] = { ...first, dividerBefore: true };
    items.push(...rowItems);
  }
  if (columnCount > 0) {
    const cols = columnCount === 1 ? 'column' : `${columnCount} columns`;
    items.push(
      { id: 'insertColumnLeft', label: `Insert ${cols} left`, dividerBefore: true },
      { id: 'insertColumnRight', label: `Insert ${cols} right` },
      { id: 'deleteColumns', label: `Delete ${cols}` },
    );
  }
  return items;
}

/** Returns the shortcut string with Ctrl swapped to ⌘ on Mac. */
export function formatShortcut(shortcut: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  return isMac ? shortcut.replace('Ctrl', '\u2318') : shortcut;
}

/** Props passed to getContextMenuHandlers (callbacks + onClose). */
export interface GridContextMenuHandlerProps {
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
}

/**
 * Returns a map of menu item id -> click handler. Each handler invokes the corresponding
 * action and then onClose. Used by the Radix and Fluent GridContextMenu components.
 */
export function getContextMenuHandlers(
  props: GridContextMenuHandlerProps
): Record<string, () => void> {
  const { onCopy, onCut, onPaste, onSelectAll, onUndo, onRedo, onClose } = props;
  return {
    undo: () => {
      onUndo();
      onClose();
    },
    redo: () => {
      onRedo();
      onClose();
    },
    copy: () => {
      onCopy();
      onClose();
    },
    cut: () => {
      onCut();
      onClose();
    },
    paste: () => {
      onPaste();
      onClose();
    },
    selectAll: () => {
      onSelectAll();
      onClose();
    },
  };
}

/** Column header menu item definition. */
export interface IColumnHeaderMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  divider?: boolean; // When true, render a visual divider/separator after this item
}

/** Column header menu items for pin/unpin actions. */
export const COLUMN_HEADER_MENU_ITEMS: IColumnHeaderMenuItem[] = [
  { id: 'pinLeft', label: 'Pin left' },
  { id: 'pinRight', label: 'Pin right' },
  { id: 'unpin', label: 'Unpin' },
];

/** Input for building column header menu items. */
export interface ColumnHeaderMenuInput {
  canPinLeft: boolean;
  canPinRight: boolean;
  canUnpin: boolean;
  currentSort?: 'asc' | 'desc' | null;
  isSortable?: boolean;
  isResizable?: boolean;
  /** Show insert/delete column items (`allowStructureEdits`). */
  canEditStructure?: boolean;
}

/**
 * Builds the complete column header menu items based on current state.
 * Returns pinning, sorting, and sizing options.
 */
export function getColumnHeaderMenuItems(input: ColumnHeaderMenuInput): IColumnHeaderMenuItem[] {
  const { canPinLeft, canPinRight, canUnpin, currentSort, isSortable = true, isResizable = true, canEditStructure = false } = input;

  const items: IColumnHeaderMenuItem[] = [];

  // Pinning section
  items.push(
    { id: 'pinLeft', label: 'Pin left', disabled: !canPinLeft },
    { id: 'pinRight', label: 'Pin right', disabled: !canPinRight },
    { id: 'unpin', label: 'Unpin', disabled: !canUnpin, divider: isSortable || isResizable },
  );

  // Sorting section
  if (isSortable) {
    if (!currentSort) {
      // No sort applied - show both options
      items.push(
        { id: 'sortAsc', label: 'Sort ascending' },
        { id: 'sortDesc', label: 'Sort descending', divider: isResizable },
      );
    } else {
      // Sort applied - show opposite + clear
      const oppositeSort = currentSort === 'asc' ? 'desc' : 'asc';
      const oppositeLabel = currentSort === 'asc' ? 'Sort descending' : 'Sort ascending';
      items.push(
        { id: `sort${oppositeSort === 'asc' ? 'Asc' : 'Desc'}`, label: oppositeLabel },
        { id: 'clearSort', label: 'Clear sort', divider: isResizable },
      );
    }
  }

  // Autosize section
  if (isResizable) {
    items.push(
      { id: 'autosizeThis', label: 'Autosize this column' },
      { id: 'autosizeAll', label: 'Autosize all columns' },
    );
  }

  // Structure section
  if (canEditStructure) {
    const last = items[items.length - 1];
    if (last) items[items.length - 1] = { ...last, divider: true };
    items.push(
      { id: 'insertColumnLeft', label: 'Insert column left' },
      { id: 'insertColumnRight', label: 'Insert column right' },
      { id: 'deleteColumn', label: 'Delete column' },
    );
  }

  return items;
}

/** Handlers for column header menu actions. */
export interface ColumnHeaderMenuHandlers {
  onPinLeft: () => void;
  onPinRight: () => void;
  onUnpin: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onClearSort: () => void;
  onAutosizeThis: () => void;
  onAutosizeAll: () => void;
  onInsertColumnLeft?: () => void;
  onInsertColumnRight?: () => void;
  onDeleteColumn?: () => void;
  onClose: () => void;
}
