import type {
  IColumnMeta,
  IColumnDef as ICoreColumnDef,
  ICellValueChangedEvent,
  CellEditorParams,
  IColumnGroupDef as ICoreColumnGroupDef,
} from '@alaarab/ogrid-core';

// Re-export unchanged types
export type { IColumnMeta, ICellValueChangedEvent, CellEditorParams } from '@alaarab/ogrid-core';
export type {
  ColumnFilterType,
  IDateFilterValue,
  IColumnFilterDef,
  IValueParserParams,
  HeaderCell,
  HeaderRow,
  IColumnDefinition,
} from '@alaarab/ogrid-core';

/** Vanilla JS column definition — extends core with DOM rendering capabilities. */
export interface IColumnDef<T = unknown> extends Omit<ICoreColumnDef<T>, 'cellEditor'> {
  /** Render cell content by mutating the cell's DOM. Return void. */
  renderCell?: (cell: HTMLTableCellElement, item: T, value: unknown) => void;
  /** Static or per-row cell inline styles (Partial<CSSStyleDeclaration>). */
  cellStyle?: Partial<CSSStyleDeclaration> | ((item: T) => Partial<CSSStyleDeclaration>);
  /** Built-in editor type or factory function that returns an HTMLElement editor. */
  cellEditor?: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date' | ((params: ICellEditorContext<T>) => HTMLElement);
}

/** Context passed to custom cell editor factories. */
export interface ICellEditorContext<T> {
  value: unknown;
  onValueChange: (value: unknown) => void;
  onCommit: () => void;
  onCancel: () => void;
  item: T;
  column: IColumnDef<T>;
  cell: HTMLTableCellElement;
  cellEditorParams?: CellEditorParams;
}

/** Column group (uses vanilla JS IColumnDef). */
export interface IColumnGroupDef<T = unknown> {
  headerName: string;
  children: (IColumnGroupDef<T> | IColumnDef<T>)[];
}
