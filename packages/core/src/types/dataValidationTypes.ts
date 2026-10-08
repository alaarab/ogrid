/** Excel-style data validation. Everything except rowFilter is JSON serializable. */
export type DataValidationOperator = 'between' | 'notBetween' | 'equal' | 'notEqual' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual';
export type DataValidationAlertStyle = 'stop' | 'warning' | 'information';
export interface IDataValidationRuleBase<T = unknown> {
  id?: string;
  columnIds: string[];
  /** Inclusive indexes into the full data, before sorting/filtering/paging. */
  rows?: { start?: number; end?: number };
  /** Optional nonserializable restriction. */
  rowFilter?: (item: T, sheetRow: number) => boolean;
  allowBlank?: boolean;
  inputMessage?: { title?: string; text: string; show?: boolean };
  errorAlert?: { style: DataValidationAlertStyle; title?: string; message?: string; show?: boolean };
  /** Formula origin; defaults to the first targeted column and rows.start (or row 0). */
  anchor?: { columnId: string; row: number };
}
export interface IListDataValidationRule<T = unknown> extends IDataValidationRuleBase<T> {
  type: 'list';
  values?: (string | number | boolean)[];
  /** A range, named range, or formula returning a range/array. */
  source?: string;
  inCellDropdown?: boolean;
}
export interface IComparisonDataValidationRule<T = unknown> extends IDataValidationRuleBase<T> {
  type: 'whole' | 'decimal' | 'date' | 'time' | 'textLength';
  operator: DataValidationOperator;
  /** Number, ISO date, HH:mm[:ss], or formula beginning with '='. */
  value: number | string;
  value2?: number | string;
}
export interface ICustomDataValidationRule<T = unknown> extends IDataValidationRuleBase<T> {
  type: 'custom';
  /** Requires formulas. Relative references shift from anchor to the cell being validated. */
  formula: string;
}
export type IDataValidationRule<T = unknown> = IListDataValidationRule<T> | IComparisonDataValidationRule<T> | ICustomDataValidationRule<T>;
export interface IDataValidationFailure<T = unknown> {
  rule: IDataValidationRule<T>;
  item: T;
  columnId: string;
  /** Sheet row. */
  rowIndex: number;
  value: unknown;
  style: DataValidationAlertStyle;
  title: string;
  message: string;
  source: 'interactive' | 'api';
}
/** Return true to accept an API warning. Stop always rejects; information always accepts. */
// biome-ignore lint/suspicious/noConfusingVoidType: notification callbacks may return nothing; warning handlers may return an approval boolean
export type OnValidationFail<T = unknown> = (failure: IDataValidationFailure<T>) => boolean | void;
