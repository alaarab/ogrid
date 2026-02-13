import { useState, useCallback } from 'react';

export interface UseColumnHeaderMenuStateParams {
  pinnedColumns: Record<string, 'left' | 'right'>;
  onPinColumn: (columnId: string, side: 'left' | 'right') => void;
  onUnpinColumn: (columnId: string) => void;
  sortBy?: string;
  sortDirection: 'asc' | 'desc';
  onColumnSort: (columnKey: string) => void;
  onColumnResized?: (columnId: string, width: number) => void;
  columns: Array<{ columnId: string; width?: number; sortable?: boolean; resizable?: boolean }>;
  data: unknown[];
  getRowId: (item: unknown) => string | number;
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
  handleSortAsc: () => void;
  handleSortDesc: () => void;
  handleClearSort: () => void;
  handleAutosizeThis: () => void;
  handleAutosizeAll: () => void;
  canPinLeft: boolean;
  canPinRight: boolean;
  canUnpin: boolean;
  currentSort: 'asc' | 'desc' | null;
  isSortable: boolean;
  isResizable: boolean;
}

/**
 * Manages state for the column header menu (pin, sort, autosize actions).
 * Tracks which column's menu is open, anchor element, and action handlers.
 */
export function useColumnHeaderMenuState(
  params: UseColumnHeaderMenuStateParams
): UseColumnHeaderMenuStateResult {
  const {
    pinnedColumns,
    onPinColumn,
    onUnpinColumn,
    sortBy,
    sortDirection,
    onColumnSort,
    onColumnResized,
    columns,
    data: _data,
    getRowId: _getRowId,
  } = params;

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

  const currentColumn = columns.find((c) => c.columnId === openForColumn);
  const currentSort = openForColumn === sortBy ? sortDirection : null;
  const isSortable = currentColumn?.sortable !== false;
  const isResizable = currentColumn?.resizable !== false;

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

  const handleSortAsc = useCallback(() => {
    if (openForColumn && isSortable) {
      onColumnSort(openForColumn);
      close();
    }
  }, [openForColumn, isSortable, onColumnSort, close]);

  const handleSortDesc = useCallback(() => {
    if (openForColumn && isSortable) {
      onColumnSort(openForColumn);
      close();
    }
  }, [openForColumn, isSortable, onColumnSort, close]);

  const handleClearSort = useCallback(() => {
    if (openForColumn && isSortable) {
      onColumnSort(openForColumn);
      close();
    }
  }, [openForColumn, isSortable, onColumnSort, close]);

  const handleAutosizeThis = useCallback(() => {
    if (!openForColumn || !onColumnResized || !isResizable) return;

    // Measure column content width
    const cells = document.querySelectorAll(`[data-column-id="${openForColumn}"]`);
    let maxWidth = 100; // Minimum width

    cells.forEach((cell) => {
      const textContent = cell.textContent || '';
      // Rough estimate: 8px per character + 32px padding
      const estimatedWidth = Math.min(textContent.length * 8 + 32, 500);
      maxWidth = Math.max(maxWidth, estimatedWidth);
    });

    onColumnResized(openForColumn, maxWidth);
    close();
  }, [openForColumn, onColumnResized, isResizable, close]);

  const handleAutosizeAll = useCallback(() => {
    if (!onColumnResized) return;

    columns.forEach((col) => {
      if (col.resizable === false) return;

      const cells = document.querySelectorAll(`[data-column-id="${col.columnId}"]`);
      let maxWidth = 100;

      cells.forEach((cell) => {
        const textContent = cell.textContent || '';
        const estimatedWidth = Math.min(textContent.length * 8 + 32, 500);
        maxWidth = Math.max(maxWidth, estimatedWidth);
      });

      onColumnResized(col.columnId, maxWidth);
    });

    close();
  }, [columns, onColumnResized, close]);

  return {
    isOpen,
    openForColumn,
    anchorElement,
    open,
    close,
    handlePinLeft,
    handlePinRight,
    handleUnpin,
    handleSortAsc,
    handleSortDesc,
    handleClearSort,
    handleAutosizeThis,
    handleAutosizeAll,
    canPinLeft,
    canPinRight,
    canUnpin,
    currentSort,
    isSortable,
    isResizable,
  };
}
