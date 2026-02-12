import { useState, useCallback } from 'react';

export interface UseColumnHeaderMenuStateParams {
  pinnedColumns: Record<string, 'left' | 'right'>;
  onPinColumn: (columnId: string, side: 'left' | 'right') => void;
  onUnpinColumn: (columnId: string) => void;
}

export interface UseColumnHeaderMenuStateResult {
  isOpen: boolean;
  openForColumn: string | null;
  anchorElement: HTMLElement | null;
  open: (columnId: string, anchorEl: HTMLElement) => void;
  close: () => void;
  handlePinLeft: () => void;
  handlePinRight: () => void;
  handleUnpin: () => void;
  canPinLeft: boolean;
  canPinRight: boolean;
  canUnpin: boolean;
}

/**
 * Manages state for the column header menu (pin left/right/unpin actions).
 * Tracks which column's menu is open, anchor element, and action handlers.
 */
export function useColumnHeaderMenuState(
  params: UseColumnHeaderMenuStateParams
): UseColumnHeaderMenuStateResult {
  const { pinnedColumns, onPinColumn, onUnpinColumn } = params;

  const [isOpen, setIsOpen] = useState(false);
  const [openForColumn, setOpenForColumn] = useState<string | null>(null);
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);

  const open = useCallback((columnId: string, anchorEl: HTMLElement) => {
    setOpenForColumn(columnId);
    setAnchorElement(anchorEl);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setOpenForColumn(null);
    setAnchorElement(null);
  }, []);

  const currentPinState = openForColumn ? pinnedColumns[openForColumn] : undefined;
  const canPinLeft = currentPinState !== 'left';
  const canPinRight = currentPinState !== 'right';
  const canUnpin = !!currentPinState;

  const handlePinLeft = useCallback(() => {
    if (openForColumn && canPinLeft) {
      onPinColumn(openForColumn, 'left');
      close();
    }
  }, [openForColumn, canPinLeft, onPinColumn, close]);

  const handlePinRight = useCallback(() => {
    if (openForColumn && canPinRight) {
      onPinColumn(openForColumn, 'right');
      close();
    }
  }, [openForColumn, canPinRight, onPinColumn, close]);

  const handleUnpin = useCallback(() => {
    if (openForColumn && canUnpin) {
      onUnpinColumn(openForColumn);
      close();
    }
  }, [openForColumn, canUnpin, onUnpinColumn, close]);

  return {
    isOpen,
    openForColumn,
    anchorElement,
    open,
    close,
    handlePinLeft,
    handlePinRight,
    handleUnpin,
    canPinLeft,
    canPinRight,
    canUnpin,
  };
}
