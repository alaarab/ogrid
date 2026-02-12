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
export declare const GRID_CONTEXT_MENU_ITEMS: GridContextMenuItem[];
/** Returns the shortcut string with Ctrl swapped to ⌘ on Mac. */
export declare function formatShortcut(shortcut: string): string;
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
export declare function getContextMenuHandlers(props: GridContextMenuHandlerProps): Record<string, () => void>;
/** Column header menu item definition. */
export interface IColumnHeaderMenuItem {
    id: string;
    label: string;
    icon?: string;
}
/** Column header menu items for pin/unpin actions. */
export declare const COLUMN_HEADER_MENU_ITEMS: IColumnHeaderMenuItem[];
