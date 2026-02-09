import * as React from 'react';

export type ColumnFilterType = 'none' | 'text' | 'multiSelect' | 'people';

export interface IColumnFilterDef {
  type: Exclude<ColumnFilterType, 'none'>;
  filterField?: string;
  optionsSource?: 'api' | 'static' | 'years';
  options?: string[];
  yearsCount?: number;
}

export interface IColumnMeta {
  columnId: string;
  name: string;
  sortable?: boolean;
  /** Omit for not filterable; set to IColumnFilterDef for filterable. */
  filterable?: IColumnFilterDef;
  defaultVisible?: boolean;
  required?: boolean;
  minWidth?: number;
  defaultWidth?: number;
  idealWidth?: number;
  /** Pin column to left or right edge (sticky during horizontal scroll). */
  pinned?: 'left' | 'right';
}

export interface IColumnDef<T = unknown> extends IColumnMeta {
  renderCell?: (item: T) => React.ReactNode;
  compare?: (a: T, b: T) => number;
  /** Compute cell value from row data (used for filtering, sorting, display when no renderCell). */
  valueGetter?: (item: T) => unknown;
  /** Format the cell value for display (used when no renderCell). */
  valueFormatter?: (value: unknown, item: T) => string;
  /** Static or per-row cell inline styles. */
  cellStyle?: React.CSSProperties | ((item: T) => React.CSSProperties);
  /** Whether the cell is editable (per-column or per-row). */
  editable?: boolean | ((item: T) => boolean);
  /** Built-in editor type or custom React component. */
  cellEditor?: 'text' | 'select' | 'checkbox' | React.ComponentType<ICellEditorProps<T>>;
  /** When true, custom cell editor is rendered in a popover/popper instead of inline. */
  cellEditorPopup?: boolean;
  /** Params passed to the cell editor (e.g. { values: string[] } for select). */
  cellEditorParams?: CellEditorParams;
}

/** Event payload when a cell value is committed after edit. */
export interface ICellValueChangedEvent<T> {
  item: T;
  columnId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  rowIndex: number;
}

/** Props passed to custom cell editor components. */
export interface ICellEditorProps<T> {
  value: unknown;
  onValueChange: (value: unknown) => void;
  onCommit: () => void;
  onCancel: () => void;
  item: T;
  column: IColumnDef<T>;
  cellEditorParams?: CellEditorParams;
}

/** Params for built-in cell editors (e.g. select: { values: string[] }). Extend for custom editors. */
export interface CellEditorParams {
  values?: unknown[];
  [key: string]: unknown;
}

/** Column group for multi-row header (has children, no columnId for data). */
export interface IColumnGroupDef<T = unknown> {
  /** Display name for the group header. */
  headerName: string;
  /** Nested groups or leaf columns. */
  children: (IColumnGroupDef<T> | IColumnDef<T>)[];
}

/** Minimal column info for the ColumnChooser (framework-agnostic). */
export interface IColumnDefinition {
  columnId: string;
  name: string;
  required?: boolean;
}
