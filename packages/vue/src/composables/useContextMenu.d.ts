import { type ShallowRef } from 'vue';
export interface ContextMenuPosition {
    x: number;
    y: number;
}
export interface UseContextMenuResult {
    contextMenuPosition: ShallowRef<ContextMenuPosition | null>;
    setContextMenuPosition: (pos: ContextMenuPosition | null) => void;
    handleCellContextMenu: (e: {
        clientX: number;
        clientY: number;
        preventDefault?: () => void;
    }) => void;
    closeContextMenu: () => void;
}
/**
 * Manages context menu position state for right-click menus.
 */
export declare function useContextMenu(): UseContextMenuResult;
