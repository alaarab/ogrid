/**
 * Column filter UI. `'number'` and `'condition'` both produce a `{ type: 'condition' }`
 * filter value (operators such as greater than, between, begins with, is blank):
 * `'number'` always uses numeric operators; `'condition'` picks numeric, date or
 * text operators from the column's `type`.
 */
export type ColumnFilterType = 'none' | 'text' | 'multiSelect' | 'people' | 'date' | 'number' | 'condition';

/** A filter choice with a display label and a string value used in filter state/requests. */
export interface IFilterOption {
  value: string;
  label: string;
}

/** Plain strings remain shorthand for a choice whose label equals its value. */
export type FilterOption = string | IFilterOption;

/** Date range filter value (ISO YYYY-MM-DD strings). Both fields optional for open-ended ranges. */
export interface IDateFilterValue {
  from?: string;
  to?: string;
}

/** Which operator set and value coercion a condition filter uses. */
export type ConditionFilterKind = 'text' | 'number' | 'date';

/**
 * Condition filter operators.
 * - All kinds: `blank`, `notBlank`.
 * - Text: `equals`, `notEquals`, `contains`, `notContains`, `beginsWith`, `endsWith` (case-insensitive).
 * - Number and date: `equals`, `notEquals`, `greaterThan`, `greaterThanOrEqual`, `lessThan`,
 *   `lessThanOrEqual`, `between` (inclusive). Dates compare by calendar day (UTC).
 * - Number only: `top` / `bottom` (the N largest / smallest values, ties included),
 *   `aboveAverage` / `belowAverage`.
 */
export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'beginsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'between'
  | 'top'
  | 'bottom'
  | 'aboveAverage'
  | 'belowAverage'
  | 'blank'
  | 'notBlank';

/**
 * One condition. `value` is the operand (a number for number filters and `top`/`bottom`'s N,
 * an ISO `YYYY-MM-DD` string for date filters, text otherwise); `valueTo` is the upper bound
 * for `between`. Numeric strings are accepted for number filters.
 */
export interface IFilterCondition {
  operator: ConditionOperator;
  value?: string | number;
  valueTo?: string | number;
}

/**
 * Serializable condition filter (Excel's custom AutoFilter): one or two conditions joined
 * with AND (default) or OR. Passed to data sources unchanged inside `filters`.
 */
export interface IConditionFilterValue {
  kind: ConditionFilterKind;
  conditions: IFilterCondition[];
  join?: 'and' | 'or';
}

export interface IColumnFilterDef {
  type: Exclude<ColumnFilterType, 'none'>;
  filterField?: string;
  /**
   * Has no effect. Multi-select options come from `options` when set, otherwise
   * from `dataSource.fetchFilterOptions()` when the data source has it, otherwise
   * from the grid's data.
   * @deprecated Not implemented. Set `options`, or implement `fetchFilterOptions` on the data source.
   */
  optionsSource?: 'api' | 'static' | 'years';
  /** Static multi-select choices. Take precedence over fetched or data-derived options. */
  options?: FilterOption[];
  /** @deprecated Has no effect: `optionsSource: 'years'` is not implemented. */
  yearsCount?: number;
}

export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | string;

export interface IColumnMeta {
  columnId: string;
  name: string;
  /** Column type shorthand. Affects alignment, default editor, filter type, sorting, and display formatting. */
  type?: 'text' | 'numeric' | 'date' | 'boolean';
  /** Display format for date columns. Supported: 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', or a custom pattern. Defaults to 'YYYY-MM-DD'. */
  dateFormat?: DateFormat;
  sortable?: boolean;
  /** Omit for not filterable; set to IColumnFilterDef for filterable. */
  filterable?: IColumnFilterDef;
  defaultVisible?: boolean;
  required?: boolean;
  /**
   * Responsive priority (0 = highest). Columns with higher numbers are hidden
   * first when the container is narrow. Columns without a priority are never
   * auto-hidden. `required` columns are never auto-hidden regardless of priority.
   */
  responsivePriority?: number;
  minWidth?: number;
  defaultWidth?: number;
  idealWidth?: number;
  /** CSS width value (e.g. '100%') to make a column fill remaining space. */
  width?: string;
  /** Pin column to left or right edge (sticky during horizontal scroll). */
  pinned?: 'left' | 'right';
}

/** Parameters passed to the valueParser function. */
export interface IValueParserParams<T = unknown> {
  /** The new value to parse (typically a string from paste or editor). */
  newValue: unknown;
  /** The current value of the cell before the edit. */
  oldValue: unknown;
  /** The row data item. */
  data: T;
  /** The column definition. */
  column: IColumnDef<T>;
}

export interface IColumnDef<T = unknown> extends IColumnMeta {
  compare?: (a: T, b: T) => number;
  /** Compute cell value from row data (used for filtering, sorting, display when no renderCell). */
  valueGetter?: (item: T) => unknown;
  /** Format the cell value for display (used when no renderCell). */
  valueFormatter?: (value: unknown, item: T) => string;
  /** Format the cell value for clipboard copy. When set, overrides valueFormatter for copy/paste. */
  clipboardFormatter?: (value: unknown, item: T) => string;
  /**
   * Parse/validate a new value before it is committed to the cell.
   * Called on paste, inline edit commit, fill handle, and delete.
   * Return the parsed value to use, or `undefined` to reject (skip) the change.
   */
  valueParser?: (params: IValueParserParams<T>) => unknown;
  /** Whether the cell is editable (per-column or per-row). */
  editable?: boolean | ((item: T) => boolean);
  /** Built-in editor type or framework-specific custom editor (e.g. React component).
   *  Core utilities never inspect this value  -  framework packages narrow the type. */
  cellEditor?: unknown;
  /** Custom (component) cell editors always render in a popover/popper and built-in editors inline; this flag currently has no effect. */
  cellEditorPopup?: boolean;
  /** Params passed to the cell editor (e.g. { values: string[] } for select). */
  cellEditorParams?: CellEditorParams;
}

/** Event payload when a cell value is committed after edit. */
export interface ICellValueChangedEvent<T> {
  item: T;
  columnId: string;
  oldValue: unknown;
  newValue: unknown;
  rowIndex: number;
  /** True when the newValue was produced by the formula engine (not a direct user edit). */
  isFormulaResult?: boolean;
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

/**
 * Params for built-in cell editors (e.g. select: { values: string[] }).
 * Premium editors from @alaarab/ogrid-react-inputs add their own options
 * (e.g. { maxStars: 5 }, { min, max, step }, { suggestions }), so arbitrary
 * keys are allowed alongside the typed built-ins below.
 */
export interface CellEditorParams {
  /** Array of allowed values for select/richSelect editors. */
  values?: unknown[];
  /** Format a value for display in rich select editor. */
  formatValue?: (value: unknown) => string;
  /**
   * Date editor display/input format. Supported: 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'.
   * Defaults to 'YYYY-MM-DD'. Only used when editorType is 'date' or column type is 'date'.
   */
  dateFormat?: DateFormat;
  /**
   * Type of date editor widget to render.
   * - 'text': plain text input with custom format parsing (default, Excel-style)
   * - 'native': browser native <input type="date"> (always YYYY-MM-DD input)
   */
  editorType?: 'text' | 'native';
  /** Editor-specific options; see the editor's docs (e.g. RatingEditor's maxStars). */
  [key: string]: unknown;
}

/** Column group for multi-row header (has children, no columnId for data). */
export interface IColumnGroupDef<T = unknown> {
  /** Display name for the group header. */
  headerName: string;
  /** Nested groups or leaf columns. */
  children: (IColumnGroupDef<T> | IColumnDef<T>)[];
}

/** A single cell in a header row (either a group header or a leaf column header). */
export interface HeaderCell<T = unknown> {
  /** Display text for this header cell. */
  label: string;
  /** Number of leaf columns this cell spans. */
  colSpan: number;
  /** True if this is a group header (not a leaf column). */
  isGroup: boolean;
  /** The leaf column definition (only set when isGroup is false). */
  columnDef?: IColumnDef<T>;
  /** The depth level of this cell in the group tree (0 = top). */
  depth: number;
}

/** A single row in the multi-row header. */
export type HeaderRow<T = unknown> = HeaderCell<T>[];

/** Minimal column info for the ColumnChooser (framework-agnostic). */
export interface IColumnDefinition {
  columnId: string;
  name: string;
  required?: boolean;
}
