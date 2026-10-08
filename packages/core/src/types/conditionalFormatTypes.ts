/**
 * Excel-style conditional formatting: a serializable rule model.
 *
 * Every rule targets one or more columns (`columnIds`) and optionally a span
 * of sheet rows (`rows`) or a row predicate (`rowFilter`, not serializable).
 * Rules are applied in priority order: `priority` ascending, then array order.
 * When two matching rules set the same style property the higher-priority one
 * wins; `stopIfTrue` stops lower-priority rules from applying to that cell.
 *
 * Statistics (min/max/average/rank/duplicates) are computed over all cells a
 * rule targets, across all its columns, as Excel does for a multi-column range.
 */

/** Style a matching rule applies. Colors are any CSS color (including `var(...)`). */
export interface IConditionalFormatStyle {
  /** Cell fill. */
  background?: string;
  /** Text color. */
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  /** Cell border color (a 1px line on each edge, drawn inside the cell). */
  border?: string;
}

/** Comparison operators for `cellValue` rules. */
export type ConditionalFormatOperator =
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'equal'
  | 'notEqual'
  | 'between'
  | 'notBetween';

/** Text match operators for `text` rules. */
export type ConditionalFormatTextOperator = 'contains' | 'notContains' | 'beginsWith' | 'endsWith';

/** Periods for `dateOccurring` rules (Excel's "A date occurring"). */
export type ConditionalFormatDatePeriod =
  | 'yesterday'
  | 'today'
  | 'tomorrow'
  | 'last7Days'
  | 'lastWeek'
  | 'thisWeek'
  | 'nextWeek'
  | 'lastMonth'
  | 'thisMonth'
  | 'nextMonth';

/**
 * Where a color scale stop or data bar end sits. `min`/`max` use the range's
 * lowest/highest number; `number` is a fixed value; `percent` is a position
 * between min and max (0-100); `percentile` is a percentile of the values (0-100).
 */
export interface IConditionalFormatValueBound {
  type: 'min' | 'max' | 'number' | 'percent' | 'percentile';
  value?: number;
}

/** One color scale stop. */
export interface IColorScaleStop extends IConditionalFormatValueBound {
  color: string;
}

/** Targeting and ordering shared by every rule. */
export interface IConditionalFormatRuleBase<T = unknown> {
  /** Optional identifier (kept through import/export; not used for matching). */
  id?: string;
  /** Columns the rule applies to. Statistics pool all of them. */
  columnIds: string[];
  /**
   * Sheet rows the rule applies to (indexes into the full data, end inclusive).
   * Serializable alternative to `rowFilter`. Statistics only count these rows.
   */
  rows?: { start?: number; end?: number };
  /** Further restrict the rule to rows for which this returns true. Not serializable. */
  rowFilter?: (item: T, sheetRow: number) => boolean;
  /** Lower runs first. Rules without one keep their array order after those with one. */
  priority?: number;
  /** When this rule matches a cell, skip lower-priority rules for that cell. */
  stopIfTrue?: boolean;
}

/** Compare the cell's value to one or two values (numbers, dates or text). */
export interface IConditionalFormatCellValueRule<T = unknown> extends IConditionalFormatRuleBase<T> {
  type: 'cellValue';
  operator: ConditionalFormatOperator;
  value: number | string | Date;
  /** Upper bound for `between` / `notBetween`. */
  value2?: number | string | Date;
  style: IConditionalFormatStyle;
}

/** Match the cell's text. Case-insensitive unless `caseSensitive`. */
export interface IConditionalFormatTextRule<T = unknown> extends IConditionalFormatRuleBase<T> {
  type: 'text';
  operator: ConditionalFormatTextOperator;
  text: string;
  caseSensitive?: boolean;
  style: IConditionalFormatStyle;
}

/** The cell holds a date in the given period (relative to today, local time). */
export interface IConditionalFormatDateRule<T = unknown> extends IConditionalFormatRuleBase<T> {
  type: 'dateOccurring';
  period: ConditionalFormatDatePeriod;
  style: IConditionalFormatStyle;
}

/** Highlight values that occur more than once (or exactly once with `unique`). Text compares case-insensitively, as in Excel. */
export interface IConditionalFormatDuplicateRule<T = unknown> extends IConditionalFormatRuleBase<T> {
  type: 'duplicateValues';
  unique?: boolean;
  style: IConditionalFormatStyle;
}

/** Top/bottom N items, or N percent of the items. */
export interface IConditionalFormatTopBottomRule<T = unknown> extends IConditionalFormatRuleBase<T> {
  type: 'topBottom';
  direction: 'top' | 'bottom';
  rank: number;
  percent?: boolean;
  style: IConditionalFormatStyle;
}

/** Above or below the range's average (optionally by a number of standard deviations). */
export interface IConditionalFormatAverageRule<T = unknown> extends IConditionalFormatRuleBase<T> {
  type: 'average';
  direction: 'above' | 'below';
  /** Include values equal to the average. */
  orEqual?: boolean;
  /** Compare against average ± this many (population) standard deviations. */
  stdDev?: number;
  style: IConditionalFormatStyle;
}

/** Blank / non-blank / error / non-error cells. Errors are formula errors (e.g. #DIV/0!). */
export interface IConditionalFormatBlankRule<T = unknown> extends IConditionalFormatRuleBase<T> {
  type: 'blanks' | 'noBlanks' | 'errors' | 'noErrors';
  style: IConditionalFormatStyle;
}

/**
 * A formula evaluated per cell by the grid's formula engine (requires
 * `formulas`). Write it for the rule's first column and first row (`rows.start`,
 * else sheet row 0 = A1 row 1): relative references shift to each cell, `$` parts stay, as when
 * Excel applies a rule to a range. `=$C1>100` highlights every targeted cell
 * in a row whose column C exceeds 100. Truthy results match.
 */
export interface IConditionalFormatFormulaRule<T = unknown> extends IConditionalFormatRuleBase<T> {
  type: 'formula';
  formula: string;
  style: IConditionalFormatStyle;
}

/** A JS predicate for grids without the formula engine. Not serializable. */
export interface IConditionalFormatPredicateRule<T = unknown> extends IConditionalFormatRuleBase<T> {
  type: 'predicate';
  test: (value: unknown, item: T, sheetRow: number) => boolean;
  style: IConditionalFormatStyle;
}

/** 2- or 3-color scale over the range's numbers. Default stops: min and max (and 50th percentile). */
export interface IConditionalFormatColorScaleRule<T = unknown> extends IConditionalFormatRuleBase<T> {
  type: 'colorScale';
  stops: [IColorScaleStop, IColorScaleStop] | [IColorScaleStop, IColorScaleStop, IColorScaleStop];
}

/** In-cell bar proportional to the value. */
export interface IConditionalFormatDataBarRule<T = unknown> extends IConditionalFormatRuleBase<T> {
  type: 'dataBar';
  /** Bar color (hex for gradient fades). Defaults to the theme's `--ogrid-cf-bar`. */
  color?: string;
  /** Bar color for negative values. Defaults to the theme's `--ogrid-cf-bar-negative`. */
  negativeColor?: string;
  /** Gradient (fades out, Excel's default) or solid fill. Default true. */
  gradient?: boolean;
  /** Lower end of the bar scale. Default: automatic (min, or 0 when all values are positive). */
  min?: IConditionalFormatValueBound;
  /** Upper end of the bar scale. Default: max. */
  max?: IConditionalFormatValueBound;
  /** Hide the cell text and show only the bar. */
  barOnly?: boolean;
}

/** Icon set names. */
export type ConditionalFormatIconSet = '3Arrows' | '3TrafficLights' | '3Symbols';

/**
 * Three-icon set. Icon 0 (best: up arrow / green) for values at or above the
 * second threshold, icon 1 at or above the first, icon 2 below. Thresholds are
 * percents of the range (default 33 and 67) unless `thresholdType` says otherwise.
 */
export interface IConditionalFormatIconSetRule<T = unknown> extends IConditionalFormatRuleBase<T> {
  type: 'iconSet';
  iconSet: ConditionalFormatIconSet;
  thresholds?: [number, number];
  thresholdType?: 'percent' | 'number' | 'percentile';
  reverse?: boolean;
  /** Hide the cell text and show only the icon. */
  iconOnly?: boolean;
}

/** One conditional formatting rule. */
export type IConditionalFormatRule<T = unknown> =
  | IConditionalFormatCellValueRule<T>
  | IConditionalFormatTextRule<T>
  | IConditionalFormatDateRule<T>
  | IConditionalFormatDuplicateRule<T>
  | IConditionalFormatTopBottomRule<T>
  | IConditionalFormatAverageRule<T>
  | IConditionalFormatBlankRule<T>
  | IConditionalFormatFormulaRule<T>
  | IConditionalFormatPredicateRule<T>
  | IConditionalFormatColorScaleRule<T>
  | IConditionalFormatDataBarRule<T>
  | IConditionalFormatIconSetRule<T>;

/** Data bar geometry for one cell (percent positions across the cell width). */
export interface ICellDataBar {
  /** Left edge, 0-100. */
  start: number;
  /** Right edge, 0-100. */
  end: number;
  color: string;
  gradient: boolean;
  negative: boolean;
  barOnly: boolean;
}

/** Icon for one cell. `index` 0 is the best icon of the set. */
export interface ICellIcon {
  set: ConditionalFormatIconSet;
  index: 0 | 1 | 2;
  iconOnly: boolean;
}

/** The combined result of every rule that applies to one cell. */
export interface ICellConditionalFormat {
  /** Merged style (background includes a color scale's color). */
  style: IConditionalFormatStyle;
  /** True when the background came from a color scale (dimmed in dark themes). */
  scaled?: boolean;
  dataBar?: ICellDataBar;
  icon?: ICellIcon;
}
