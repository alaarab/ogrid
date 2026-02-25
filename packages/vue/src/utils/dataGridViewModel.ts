/**
 * View model helpers for Vue DataGridTable.
 * Pure functions live in @alaarab/ogrid-core. This file re-exports them
 * and adds Vue-specific helpers (getCellInteractionProps uses Vue event naming).
 */

import type { RowId } from '@alaarab/ogrid-core';

// Re-export everything from core's dataGridViewModel
export {
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
} from '@alaarab/ogrid-core';
export type {
  HeaderFilterConfigInput,
  HeaderFilterConfig,
  CellRenderDescriptorInput,
  CellRenderDescriptor,
  CellRenderMode,
} from '@alaarab/ogrid-core';

// Re-import CellRenderDescriptor for use in getCellInteractionProps
import type { CellRenderDescriptor } from '@alaarab/ogrid-core';

// --- Vue-specific: getCellInteractionProps uses native MouseEvent + Vue event naming ---

export interface CellInteractionHandlers {
  handleCellMouseDown: (e: MouseEvent, rowIndex: number, colIndex: number) => void;
  setActiveCell: (cell: { rowIndex: number; columnIndex: number }) => void;
  setEditingCell: (cell: { rowId: RowId; columnId: string } | null) => void;
  handleCellContextMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }) => void;
}

export interface CellInteractionProps {
  'data-row-index': number;
  'data-col-index': number;
  'data-active-cell'?: 'true';
  'data-in-range'?: 'true';
  tabindex: number;
  role?: 'button';
  onMousedown: (e: MouseEvent) => void;
  onClick: () => void;
  onContextmenu: (e: MouseEvent) => void;
  onDblclick?: () => void;
}

export function getCellInteractionProps(
  descriptor: CellRenderDescriptor,
  columnId: string,
  handlers: CellInteractionHandlers
): CellInteractionProps {
  const base: CellInteractionProps = {
    'data-row-index': descriptor.rowIndex,
    'data-col-index': descriptor.globalColIndex,
    ...(descriptor.isActive ? { 'data-active-cell': 'true' as const } : {}),
    ...(descriptor.isInRange ? { 'data-in-range': 'true' as const } : {}),
    tabindex: descriptor.isActive ? 0 : -1,
    onMousedown: (e: MouseEvent) =>
      handlers.handleCellMouseDown(e, descriptor.rowIndex, descriptor.globalColIndex),
    onClick: () =>
      handlers.setActiveCell({ rowIndex: descriptor.rowIndex, columnIndex: descriptor.globalColIndex }),
    onContextmenu: (e: MouseEvent) => handlers.handleCellContextMenu(e),
  };
  if (descriptor.canEditAny) {
    base.role = 'button';
    base.onDblclick = () =>
      handlers.setEditingCell({ rowId: descriptor.rowId, columnId });
  }
  return base;
}
