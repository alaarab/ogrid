import { useState, useLayoutEffect } from 'react';
import type { IActiveCell } from '../types';

export interface UseActiveCellResult {
  activeCell: IActiveCell | null;
  setActiveCell: (cell: IActiveCell | null) => void;
}

/**
 * Tracks the active cell for keyboard navigation.
 * When wrapperRef and editingCell are provided, scrolls the active cell into view when it changes (and not editing).
 */
export function useActiveCell(
  wrapperRef?: React.RefObject<HTMLElement | null>,
  editingCell?: { rowId: string; columnId: string } | null
): UseActiveCellResult {
  const [activeCell, setActiveCell] = useState<IActiveCell | null>(null);

  // useLayoutEffect ensures focus moves synchronously before the browser can
  // reset focus to body (fixes left/right arrow navigation losing focus)
  useLayoutEffect(() => {
    if (
      activeCell == null ||
      wrapperRef?.current == null ||
      editingCell != null
    )
      return;
    const { rowIndex, columnIndex } = activeCell;
    const selector = `[data-row-index="${rowIndex}"][data-col-index="${columnIndex}"]`;
    const cell = wrapperRef.current.querySelector(selector) as HTMLElement | null;
    if (cell) {
      if (typeof cell.scrollIntoView === 'function') {
        cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      if (document.activeElement !== cell && typeof cell.focus === 'function') {
        cell.focus();
      }
    }
  }, [activeCell, editingCell, wrapperRef]);

  return { activeCell, setActiveCell };
}
