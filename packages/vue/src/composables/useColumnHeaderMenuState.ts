import { ref, computed, type Ref } from 'vue';
import { measureColumnContentWidth } from '@alaarab/ogrid-core';
import type { IColumnDef } from '../types';

export interface UseColumnHeaderMenuStateParams<T = unknown> {
  columns: Ref<IColumnDef<T>[]>;
  pinnedColumns: Ref<Record<string, 'left' | 'right'>>;
  onPinColumn: (columnId: string, side: 'left' | 'right') => void;
  onUnpinColumn: (columnId: string) => void;
  onSort?: (columnId: string, direction: 'asc' | 'desc' | null) => void;
  onColumnResized?: (columnId: string, width: number) => void;
  onAutosizeColumn?: (columnId: string, width: number) => void;
  sortBy?: Ref<string | undefined>;
  sortDirection?: Ref<'asc' | 'desc' | undefined>;
  data?: Ref<unknown[]>;
  getRowId?: (item: unknown) => string | number;
}

export interface UseColumnHeaderMenuStateResult {
  isOpen: Ref<boolean>;
  openForColumn: Ref<string | null>;
  anchorElement: Ref<HTMLElement | null>;
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
  canPinLeft: Ref<boolean>;
  canPinRight: Ref<boolean>;
  canUnpin: Ref<boolean>;
  currentSort: Ref<'asc' | 'desc' | null>;
  isSortable: Ref<boolean>;
  isResizable: Ref<boolean>;
}

/**
 * Manages state for the column header menu (pin/unpin, sort, autosize actions).
 * Tracks which column's menu is open, anchor element, and action handlers.
 */
export function useColumnHeaderMenuState<T = unknown>(
  params: UseColumnHeaderMenuStateParams<T>
): UseColumnHeaderMenuStateResult {
  const {
    columns,
    pinnedColumns,
    onPinColumn,
    onUnpinColumn,
    onSort,
    onColumnResized,
    onAutosizeColumn,
    sortBy,
    sortDirection,
  } = params;

  const isOpen = ref(false);
  const openForColumn = ref<string | null>(null);
  const anchorElement = ref<HTMLElement | null>(null);

  const open = (columnId: string, anchorEl: HTMLElement) => {
    openForColumn.value = columnId;
    anchorElement.value = anchorEl;
    isOpen.value = true;
  };

  const close = () => {
    isOpen.value = false;
    openForColumn.value = null;
    anchorElement.value = null;
  };

  const currentColumn = computed(() =>
    openForColumn.value ? columns.value.find((c) => c.columnId === openForColumn.value) : undefined
  );

  const currentPinState = computed(() =>
    openForColumn.value ? pinnedColumns.value[openForColumn.value] : undefined
  );

  const canPinLeft = computed(() => currentPinState.value !== 'left');
  const canPinRight = computed(() => currentPinState.value !== 'right');
  const canUnpin = computed(() => !!currentPinState.value);

  const currentSort = computed(() => {
    if (!openForColumn.value || !sortBy?.value || sortBy.value !== openForColumn.value) {
      return null;
    }
    return sortDirection?.value ?? null;
  });

  const isSortable = computed(() => {
    const col = currentColumn.value;
    return col?.sortable !== false;
  });

  // All columns are resizable by default (no per-column resizable flag in core)
  const isResizable = ref(true);

  const handlePinLeft = () => {
    if (openForColumn.value && canPinLeft.value) {
      onPinColumn(openForColumn.value, 'left');
      close();
    }
  };

  const handlePinRight = () => {
    if (openForColumn.value && canPinRight.value) {
      onPinColumn(openForColumn.value, 'right');
      close();
    }
  };

  const handleUnpin = () => {
    if (openForColumn.value && canUnpin.value) {
      onUnpinColumn(openForColumn.value);
      close();
    }
  };

  const handleSortAsc = () => {
    if (openForColumn.value && onSort) {
      onSort(openForColumn.value, 'asc');
      close();
    }
  };

  const handleSortDesc = () => {
    if (openForColumn.value && onSort) {
      onSort(openForColumn.value, 'desc');
      close();
    }
  };

  const handleClearSort = () => {
    if (openForColumn.value && onSort) {
      onSort(openForColumn.value, null);
      close();
    }
  };

  const handleAutosizeThis = () => {
    const resizer = onAutosizeColumn ?? onColumnResized;
    if (!openForColumn.value || !resizer || !isResizable.value) return;

    const col = currentColumn.value;
    resizer(openForColumn.value, measureColumnContentWidth(openForColumn.value, col?.minWidth));
    close();
  };

  const handleAutosizeAll = () => {
    const resizer = onAutosizeColumn ?? onColumnResized;
    if (!resizer) return;

    columns.value.forEach((col) => {
      resizer(col.columnId, measureColumnContentWidth(col.columnId, col.minWidth));
    });

    close();
  };

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
