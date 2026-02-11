import * as React from 'react';
import type {
  IColumnDef as ICoreColumnDef,
  CellEditorParams,
} from '@alaarab/ogrid-core';

// Re-export shared types directly from core (no React-specific changes)
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
 * React-specific column definition. Extends core's framework-agnostic IColumnDef
 * with renderCell, cellStyle, and a narrowed cellEditor type.
 */
export interface IColumnDef<T = unknown> extends ICoreColumnDef<T> {
  /** Custom cell renderer (React-specific). */
  renderCell?: (item: T) => React.ReactNode;
  /** Static or per-row cell inline styles (React-specific). */
  cellStyle?: React.CSSProperties | ((item: T) => React.CSSProperties);
  /** Built-in editor type or custom React component. */
  cellEditor?: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date' | React.ComponentType<ICellEditorProps<T>>;
}
