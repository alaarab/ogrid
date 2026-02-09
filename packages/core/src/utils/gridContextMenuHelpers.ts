/**
 * Shared definition for grid context menu items. Used by Fluent, Material, and Radix GridContextMenu components.
 */
export interface GridContextMenuItem {
  id: string;
  label: string;
  /** When true, the item is disabled when there is no cell selection (e.g. Copy, Cut). */
  disabledWhenNoSelection?: boolean;
}

export const GRID_CONTEXT_MENU_ITEMS: GridContextMenuItem[] = [
  { id: 'copy', label: 'Copy', disabledWhenNoSelection: true },
  { id: 'cut', label: 'Cut', disabledWhenNoSelection: true },
  { id: 'paste', label: 'Paste' },
  { id: 'selectAll', label: 'Select all' },
];

/** Props passed to getContextMenuHandlers (callbacks + onClose). */
export interface GridContextMenuHandlerProps {
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onClose: () => void;
}

/**
 * Returns a map of menu item id -> click handler. Each handler invokes the corresponding
 * action and then onClose. Used by Fluent, Material, and Radix GridContextMenu components.
 */
export function getContextMenuHandlers(
  props: GridContextMenuHandlerProps
): Record<string, () => void> {
  const { onCopy, onCut, onPaste, onSelectAll, onClose } = props;
  return {
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
