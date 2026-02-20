/**
 * Shared props interface for ColumnChooser across all React UI packages.
 * Each UI package renders its own framework-specific trigger, popover, and checkboxes
 * but shares this common prop shape.
 */

import type { IColumnDefinition } from '../types/columnTypes';

export interface IColumnChooserProps {
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, visible: boolean) => void;
  /** Optional batch setter — used by select-all / clear-all for a single state update. */
  onSetVisibleColumns?: (columns: Set<string>) => void;
  className?: string;
}
