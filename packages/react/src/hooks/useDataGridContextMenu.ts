import { useMemo } from 'react';
import { useContextMenu } from './useContextMenu';
import type { DataGridContextMenuState } from './useDataGridState';

// Stable no-op handlers used when cellSelection is disabled
const NOOP = () => {};
const NOOP_CTX = (_e: { clientX: number; clientY: number; preventDefault?: () => void }) => {};
const NOOP_PTR = (_e: React.PointerEvent) => {};

export interface UseDataGridContextMenuParams {
  cellSelection: boolean;
}

export interface UseDataGridContextMenuResult {
  contextMenu: DataGridContextMenuState;
  contextMenuPosition: { x: number; y: number } | null;
  setContextMenuPosition: (pos: { x: number; y: number } | null) => void;
}

/**
 * Manages context menu position and handlers.
 * Extracted from useDataGridState for modularity.
 */
export function useDataGridContextMenu(
  params: UseDataGridContextMenuParams
): UseDataGridContextMenuResult {
  const { cellSelection } = params;

  const { contextMenuPosition, setContextMenuPosition, handleCellContextMenu, closeContextMenu, handleLongPressStart, handleLongPressEnd } =
    useContextMenu();

  const contextMenuState = useMemo<DataGridContextMenuState>(() => ({
    menuPosition: cellSelection ? contextMenuPosition : null,
    setMenuPosition: cellSelection ? setContextMenuPosition : (NOOP as typeof setContextMenuPosition),
    handleCellContextMenu: cellSelection ? handleCellContextMenu : (NOOP_CTX as typeof handleCellContextMenu),
    closeContextMenu: cellSelection ? closeContextMenu : NOOP,
    handleLongPressStart: cellSelection ? handleLongPressStart : (NOOP_PTR as typeof handleLongPressStart),
    handleLongPressEnd: cellSelection ? handleLongPressEnd : NOOP,
  }), [cellSelection, contextMenuPosition, setContextMenuPosition, handleCellContextMenu, closeContextMenu, handleLongPressStart, handleLongPressEnd]);

  return {
    contextMenu: contextMenuState,
    contextMenuPosition,
    setContextMenuPosition,
  };
}
