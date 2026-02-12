/**
 * Shared definition for grid context menu items. Used by Fluent, Material, and Radix GridContextMenu components.
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
 * action and then onClose. Used by Fluent, Material, and Radix GridContextMenu components.
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
}

/** Column header menu items for pin/unpin actions. */
export const COLUMN_HEADER_MENU_ITEMS: IColumnHeaderMenuItem[] = [
  { id: 'pinLeft', label: 'Pin left' },
  { id: 'pinRight', label: 'Pin right' },
  { id: 'unpin', label: 'Unpin' },
];
