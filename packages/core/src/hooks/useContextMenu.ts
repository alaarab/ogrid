import { useState, useCallback } from 'react';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface UseContextMenuResult {
  contextMenu: ContextMenuPosition | null;
  setContextMenu: (pos: ContextMenuPosition | null) => void;
  handleCellContextMenu: (e: { clientX: number; clientY: number }) => void;
  closeContextMenu: () => void;
}

export function useContextMenu(): UseContextMenuResult {
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);

  const handleCellContextMenu = useCallback((e: { clientX: number; clientY: number }) => {
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    setContextMenu,
    handleCellContextMenu,
    closeContextMenu,
  };
}
