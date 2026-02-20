/**
 * Headless column chooser state and handlers for Fluent, Material, and Radix.
 * UI packages use this hook and render only trigger + popover (checkboxes, Select All, Clear All).
 */

import { useState, useCallback, useEffect } from 'react';
import type { IColumnDefinition } from '../types/columnTypes';

export interface UseColumnChooserStateParams {
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, visible: boolean) => void;
  /** Optional batch setter for select-all / clear-all — avoids N individual callbacks. */
  onSetVisibleColumns?: (columns: Set<string>) => void;
}

export interface UseColumnChooserStateResult {
  open: boolean;
  setOpen: (open: boolean) => void;
  handleToggle: () => void;
  handleClose: () => void;
  handleCheckboxChange: (columnKey: string) => (visible: boolean) => void;
  handleSelectAll: () => void;
  handleClearAll: () => void;
  visibleCount: number;
  totalCount: number;
}

/**
 * Returns open/setOpen, handleToggle, handleClose (Escape handled in hook),
 * handleCheckboxChange(columnKey)(visible), handleSelectAll, handleClearAll,
 * visibleCount, totalCount. UI renders trigger + popover and wires handlers.
 */
export function useColumnChooserState(
  params: UseColumnChooserStateParams
): UseColumnChooserStateResult {
  const { columns, visibleColumns, onVisibilityChange, onSetVisibleColumns } = params;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open]);

  const handleToggle = useCallback((): void => {
    setOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback((): void => {
    setOpen(false);
  }, []);

  const handleCheckboxChange = useCallback(
    (columnKey: string) =>
      (visible: boolean): void => {
        onVisibilityChange(columnKey, visible);
      },
    [onVisibilityChange]
  );

  const handleSelectAll = useCallback((): void => {
    if (onSetVisibleColumns) {
      onSetVisibleColumns(new Set(columns.map((col) => col.columnId)));
    } else {
      columns.forEach((col) => {
        if (!visibleColumns.has(col.columnId)) {
          onVisibilityChange(col.columnId, true);
        }
      });
    }
  }, [columns, visibleColumns, onVisibilityChange, onSetVisibleColumns]);

  const handleClearAll = useCallback((): void => {
    if (onSetVisibleColumns) {
      // Keep required columns visible
      const required = new Set(columns.filter((col) => col.required).map((col) => col.columnId));
      onSetVisibleColumns(required);
    } else {
      columns.forEach((col) => {
        if (!col.required && visibleColumns.has(col.columnId)) {
          onVisibilityChange(col.columnId, false);
        }
      });
    }
  }, [columns, visibleColumns, onVisibilityChange, onSetVisibleColumns]);

  const visibleCount = visibleColumns.size;
  const totalCount = columns.length;

  return {
    open,
    setOpen,
    handleToggle,
    handleClose,
    handleCheckboxChange,
    handleSelectAll,
    handleClearAll,
    visibleCount,
    totalCount,
  };
}
