/**
 * View model helpers for DataGridTable.
 * Pure functions are now in @alaarab/ogrid-core. This file re-exports them
 * and adds React-specific helpers / type narrowing.
 */

import type * as React from 'react';
import type { IColumnDef } from '../types/columnTypes';
import type { RowId } from '../types/dataGridTypes';
import type { ICellEditorProps } from '../types/columnTypes';
import {
  resolveCellDisplayContent as coreResolveCellDisplayContent,
  resolveCellStyle as coreResolveCellStyle,
  buildInlineEditorProps as coreBuildInlineEditorProps,
  buildPopoverEditorProps as coreBuildPopoverEditorProps,
} from '@alaarab/ogrid-core';
import type { CellRenderDescriptor } from '@alaarab/ogrid-core';

// Re-export pure functions from core (no type narrowing needed)
export {
  getHeaderFilterConfig,
  getCellRenderDescriptor,
} from '@alaarab/ogrid-core';
export type {
  HeaderFilterConfigInput,
  HeaderFilterConfig,
  CellRenderDescriptorInput,
  CellRenderDescriptor,
  CellRenderMode,
} from '@alaarab/ogrid-core';

// --- React-typed wrappers for functions that need type narrowing ---

/**
 * Resolves display content for a cell in display mode.
 * Returns React.ReactNode for JSX compatibility.
 */
export function resolveCellDisplayContent<T>(
  col: IColumnDef<T>,
  item: T,
  displayValue: unknown
): React.ReactNode {
  return coreResolveCellDisplayContent(col, item, displayValue) as React.ReactNode;
}

/**
 * Resolves the cellStyle from a column def.
 * Returns React.CSSProperties for JSX compatibility.
 */
export function resolveCellStyle<T>(
  col: IColumnDef<T>,
  item: T,
  displayValue?: unknown
): React.CSSProperties | undefined {
  return coreResolveCellStyle(col, item, displayValue) as React.CSSProperties | undefined;
}

/**
 * Builds props for InlineCellEditor with React-specific IColumnDef.
 */
export function buildInlineEditorProps<T>(
  item: T,
  col: IColumnDef<T>,
  descriptor: CellRenderDescriptor,
  callbacks: {
    commitCellEdit: (item: T, columnId: string, oldValue: unknown, newValue: unknown, rowIndex: number, globalColIndex: number) => void;
    setEditingCell: (cell: null) => void;
  }
): {
  value: unknown;
  item: T;
  column: IColumnDef<T>;
  rowIndex: number;
  editorType: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';
  onCommit: (newValue: unknown) => void;
  onCancel: () => void;
} {
  const result = coreBuildInlineEditorProps(item, col, descriptor, callbacks);
  return { ...result, column: col };
}

/**
 * Builds ICellEditorProps for custom popover editors with React-specific IColumnDef.
 */
export function buildPopoverEditorProps<T>(
  item: T,
  col: IColumnDef<T>,
  descriptor: CellRenderDescriptor,
  pendingEditorValue: unknown,
  callbacks: {
    setPendingEditorValue: (value: unknown) => void;
    commitCellEdit: (item: T, columnId: string, oldValue: unknown, newValue: unknown, rowIndex: number, globalColIndex: number) => void;
    cancelPopoverEdit: () => void;
  }
): ICellEditorProps<T> {
  const result = coreBuildPopoverEditorProps(item, col, descriptor, pendingEditorValue, callbacks);
  return { ...result, column: col };
}

// --- React-specific: getCellInteractionProps uses React.MouseEvent ---

export interface CellInteractionHandlers {
  handleCellMouseDown: (e: React.MouseEvent, rowIndex: number, colIndex: number) => void;
  setActiveCell: (cell: { rowIndex: number; columnIndex: number }) => void;
  setEditingCell: (cell: { rowId: RowId; columnId: string } | null) => void;
  handleCellContextMenu: (e: React.MouseEvent) => void;
}

export function getCellInteractionProps(
  descriptor: CellRenderDescriptor,
  columnId: string,
  handlers: CellInteractionHandlers
) {
  return {
    'data-row-index': descriptor.rowIndex,
    'data-col-index': descriptor.globalColIndex,
    ...(descriptor.isActive ? { 'data-active-cell': 'true' as const } : {}),
    ...(descriptor.isInRange ? { 'data-in-range': 'true' as const } : {}),
    tabIndex: descriptor.isActive ? 0 : -1,
    onMouseDown: (e: React.MouseEvent) =>
      handlers.handleCellMouseDown(e, descriptor.rowIndex, descriptor.globalColIndex),
    onClick: () =>
      handlers.setActiveCell({ rowIndex: descriptor.rowIndex, columnIndex: descriptor.globalColIndex }),
    onContextMenu: handlers.handleCellContextMenu,
    ...(descriptor.canEditAny
      ? {
          role: 'button' as const,
          onDoubleClick: () =>
            handlers.setEditingCell({ rowId: descriptor.rowId, columnId }),
        }
      : {}),
  };
}
