/**
 * View model helpers for Angular DataGridTable.
 * Pure functions live in @alaarab/ogrid-core. This file re-exports them.
 */

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
