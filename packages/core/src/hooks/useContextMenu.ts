import { useState, useCallback } from 'react';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface UseContextMenuResult {
  contextMenuPosition: ContextMenuPosition | null;
  setContextMenuPosition: (pos: ContextMenuPosition | null) => void;
  handleCellContextMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }) => void;
  closeContextMenu: () => void;
}

/**
 * Manages context menu position state for right-click menus.
 * @returns Menu position, setter, right-click handler, and close handler.
 */
export function useContextMenu(): UseContextMenuResult {
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null);

  const handleCellContextMenu = useCallback((e: { clientX: number; clientY: number; preventDefault?: () => void }) => {
    e.preventDefault?.();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuPosition(null);
  }, []);

  return {
    contextMenuPosition,
    setContextMenuPosition,
    handleCellContextMenu,
    closeContextMenu,
  };
}
