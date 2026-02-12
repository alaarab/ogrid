import { ref, type Ref } from 'vue';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface UseContextMenuResult {
  contextMenuPosition: Ref<ContextMenuPosition | null>;
  setContextMenuPosition: (pos: ContextMenuPosition | null) => void;
  handleCellContextMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }) => void;
  closeContextMenu: () => void;
}

/**
 * Manages context menu position state for right-click menus.
 */
export function useContextMenu(): UseContextMenuResult {
  const contextMenuPosition = ref<ContextMenuPosition | null>(null);

  const setContextMenuPosition = (pos: ContextMenuPosition | null) => {
    contextMenuPosition.value = pos;
  };

  const handleCellContextMenu = (e: { clientX: number; clientY: number; preventDefault?: () => void }) => {
    e.preventDefault?.();
    contextMenuPosition.value = { x: e.clientX, y: e.clientY };
  };

  const closeContextMenu = () => {
    contextMenuPosition.value = null;
  };

  return {
    contextMenuPosition,
    setContextMenuPosition,
    handleCellContextMenu,
    closeContextMenu,
  };
}
