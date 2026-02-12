/**
 * Shared utilities for Angular DataGridTable view layer.
 */

export type {
  HeaderFilterConfigInput,
  HeaderFilterConfig,
  CellRenderDescriptorInput,
  CellRenderDescriptor,
  CellRenderMode,
} from './dataGridViewModel';

export {
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  resolveCellDisplayContent,
  resolveCellStyle,
} from './dataGridViewModel';

// Debounce utilities
export {
  createDebouncedSignal,
  createDebouncedCallback,
  debounce,
} from './debounce';

// Latest ref utilities
export {
  createLatestRef,
  createLatestCallback,
} from './latestRef';
