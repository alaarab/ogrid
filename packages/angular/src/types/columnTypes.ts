import type { Type, TemplateRef } from '@angular/core';
import type {
  IColumnDef as ICoreColumnDef,
  CellEditorParams,
} from '@alaarab/ogrid-core';

// Re-export shared types directly from core (no Angular-specific changes)
export type {
  ColumnFilterType,
  IDateFilterValue,
  IColumnFilterDef,
  IColumnMeta,
  IValueParserParams,
  ICellValueChangedEvent,
  CellEditorParams,
  IColumnGroupDef,
  HeaderCell,
  HeaderRow,
  IColumnDefinition,
} from '@alaarab/ogrid-core';

/** Props passed to custom cell editor components. */
export interface ICellEditorProps<T = unknown> {
  value: unknown;
  onValueChange: (value: unknown) => void;
  onCommit: () => void;
  onCancel: () => void;
  item: T;
  column: IColumnDef<T>;
  cellEditorParams?: CellEditorParams;
}

/**
 * Angular-specific column definition. Extends core's framework-agnostic IColumnDef
 * with renderCell, cellStyle, and a narrowed cellEditor type.
 */
export interface IColumnDef<T = unknown> extends ICoreColumnDef<T> {
  /** Custom cell renderer — TemplateRef or string function (Angular-specific). */
  renderCell?: TemplateRef<{ $implicit: T }> | ((item: T) => string);
  /** Static or per-row cell inline styles (Angular-specific). */
  cellStyle?: Record<string, string> | ((item: T) => Record<string, string>);
  /** Built-in editor type or custom Angular component class. */
  cellEditor?: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date' | Type<unknown>;
}
