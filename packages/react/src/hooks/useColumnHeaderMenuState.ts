import { useState, useCallback } from 'react';
import { measureColumnContentWidth } from '../utils';

export interface UseColumnHeaderMenuStateParams {
  pinnedColumns: Record<string, 'left' | 'right'>;
  onPinColumn: (columnId: string, side: 'left' | 'right') => void;
  onUnpinColumn: (columnId: string) => void;
  sortBy?: string;
  sortDirection: 'asc' | 'desc';
  onColumnSort: (columnKey: string, direction?: 'asc' | 'desc' | null) => void;
  onColumnResized?: (columnId: string, width: number) => void;
  onAutosizeColumn?: (columnId: string, width: number) => void;
  columns: Array<{ columnId: string; width?: number; minWidth?: number; sortable?: boolean; resizable?: boolean }>;
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
    onAutosizeColumn,
    columns,
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
      onColumnSort(openForColumn, 'asc');
      close();
    }
  }, [openForColumn, isSortable, onColumnSort, close]);

  const handleSortDesc = useCallback(() => {
    if (openForColumn && isSortable) {
      onColumnSort(openForColumn, 'desc');
      close();
    }
  }, [openForColumn, isSortable, onColumnSort, close]);

  const handleClearSort = useCallback(() => {
    if (openForColumn && isSortable) {
      onColumnSort(openForColumn, null);
      close();
    }
  }, [openForColumn, isSortable, onColumnSort, close]);

  const handleAutosizeThis = useCallback(() => {
    const resizer = onAutosizeColumn ?? onColumnResized;
    if (!openForColumn || !resizer || !isResizable) return;

    const col = columns.find((c) => c.columnId === openForColumn);
    resizer(openForColumn, measureColumnContentWidth(openForColumn, col?.minWidth));
    close();
  }, [openForColumn, onAutosizeColumn, onColumnResized, isResizable, columns, close]);

  const handleAutosizeAll = useCallback(() => {
    const resizer = onAutosizeColumn ?? onColumnResized;
    if (!resizer) return;

    columns.forEach((col) => {
      if (col.resizable === false) return;
      resizer(col.columnId, measureColumnContentWidth(col.columnId, col.minWidth));
    });

    close();
  }, [columns, onAutosizeColumn, onColumnResized, close]);

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

/**
 * Maps a UseColumnHeaderMenuStateResult to the flat ColumnHeaderMenuProps shape.
 * Eliminates the 18-prop spread that each DataGridTable package repeats.
 */
export function getColumnHeaderMenuProps(headerMenu: UseColumnHeaderMenuStateResult) {
  return {
    isOpen: headerMenu.isOpen,
    anchorElement: headerMenu.anchorElement,
    onClose: headerMenu.close,
    onPinLeft: headerMenu.handlePinLeft,
    onPinRight: headerMenu.handlePinRight,
    onUnpin: headerMenu.handleUnpin,
    onSortAsc: headerMenu.handleSortAsc,
    onSortDesc: headerMenu.handleSortDesc,
    onClearSort: headerMenu.handleClearSort,
    onAutosizeThis: headerMenu.handleAutosizeThis,
    onAutosizeAll: headerMenu.handleAutosizeAll,
    canPinLeft: headerMenu.canPinLeft,
    canPinRight: headerMenu.canPinRight,
    canUnpin: headerMenu.canUnpin,
    currentSort: headerMenu.currentSort,
    isSortable: headerMenu.isSortable,
    isResizable: headerMenu.isResizable,
  };
}
