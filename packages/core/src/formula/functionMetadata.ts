/**
 * Function metadata: signatures, one-line descriptions and categories for the
 * built-in formula functions. Drives formula autocomplete and argument hints.
 *
 * Signatures use Excel's notation: `[arg]` is optional, and a trailing `...`
 * repeats the last bracketed group (`number1, [number2], ...`).
 * `functionMetadata.test.ts` checks every registered function has an entry
 * whose arity matches the registry's minArgs/maxArgs.
 */

import type { IFormulaFunction } from './types';

export type FormulaFunctionCategory =
  | 'Math'
  | 'Logical'
  | 'Lookup'
  | 'Text'
  | 'Date'
  | 'Statistical'
  | 'Information'
  | 'Financial'
  | 'Custom';

export interface IFormulaFunctionArg {
  name: string;
  optional: boolean;
}

export interface IFormulaFunctionMetadata {
  /** Upper-case function name, e.g. "SUMIFS". */
  name: string;
  description: string;
  category: FormulaFunctionCategory;
  args: IFormulaFunctionArg[];
  /**
   * Repeating argument group from a trailing `...`: `args[repeatStart]` up to
   * the end repeat. `undefined` for fixed-arity functions.
   */
  repeatStart?: number;
  /** Signature text, e.g. "SUM(number1, [number2], ...)". */
  signature: string;
}

type Entry = [category: FormulaFunctionCategory, args: string, description: string];

const M = 'Math';
const L = 'Logical';
const R = 'Lookup';
const T = 'Text';
const D = 'Date';
const S = 'Statistical';
const I = 'Information';
const F = 'Financial';

const CRITERIA_PAIRS = 'criteria_range1, criteria1, [criteria_range2, criteria2], ...';
const TEXT_SPLIT_TAIL = '[instance_num], [match_mode], [match_end], [if_not_found]';

const BUILT_INS: Record<string, Entry> = {
  ABS: [M, 'number', 'Returns the absolute value of a number.'],
  ACOS: [M, 'number', 'Returns the arccosine of a number, in radians.'],
  ADDRESS: [R, 'row_num, column_num, [abs_num], [a1], [sheet_text]', 'Returns a cell reference as text, given row and column numbers.'],
  AND: [L, 'logical1, [logical2], ...', 'Returns TRUE if all of its arguments are TRUE.'],
  ASIN: [M, 'number', 'Returns the arcsine of a number, in radians.'],
  ATAN: [M, 'number', 'Returns the arctangent of a number, in radians.'],
  ATAN2: [M, 'x_num, y_num', 'Returns the arctangent of x and y coordinates, in radians.'],
  AVERAGE: [S, 'number1, [number2], ...', 'Returns the average (arithmetic mean) of its arguments.'],
  AVERAGEIF: [S, 'range, criteria, [average_range]', 'Returns the average of the cells that meet a criterion.'],
  AVERAGEIFS: [S, `average_range, ${CRITERIA_PAIRS}`, 'Returns the average of the cells that meet multiple criteria.'],
  CEILING: [M, 'number, significance', 'Rounds a number up to the nearest multiple of significance.'],
  'CEILING.MATH': [M, 'number, [significance], [mode]', 'Rounds a number up to the nearest integer or multiple of significance.'],
  CHAR: [T, 'number', 'Returns the character specified by a code number.'],
  CHOOSE: [R, 'index_num, value1, [value2], ...', 'Chooses a value from a list by its index.'],
  CLEAN: [T, 'text', 'Removes non-printable characters from text.'],
  CODE: [T, 'text', 'Returns the numeric code of the first character in text.'],
  COLUMN: [R, '[reference]', 'Returns the column number of a reference.'],
  COLUMNS: [R, 'array', 'Returns the number of columns in a reference or array.'],
  COMBIN: [M, 'number, number_chosen', 'Returns the number of combinations for a given number of items.'],
  CONCAT: [T, 'text1, [text2], ...', 'Joins several text items or ranges into one text string.'],
  CONCATENATE: [T, 'text1, [text2], ...', 'Joins several text items into one text string.'],
  CORREL: [S, 'array1, array2', 'Returns the correlation coefficient between two data sets.'],
  COS: [M, 'number', 'Returns the cosine of an angle given in radians.'],
  COUNT: [S, 'value1, [value2], ...', 'Counts the cells that contain numbers.'],
  COUNTA: [S, 'value1, [value2], ...', 'Counts the cells that are not empty.'],
  COUNTBLANK: [S, 'range', 'Counts the empty cells in a range.'],
  COUNTIF: [S, 'range, criteria', 'Counts the cells in a range that meet a criterion.'],
  COUNTIFS: [S, CRITERIA_PAIRS, 'Counts the cells that meet multiple criteria.'],
  DATE: [D, 'year, month, day', 'Returns the serial number of a date.'],
  DATEDIF: [D, 'start_date, end_date, unit', 'Returns the number of days, months or years between two dates.'],
  DATEVALUE: [D, 'date_text', 'Converts a date stored as text to a serial number.'],
  DAY: [D, 'serial_number', 'Returns the day of the month (1 to 31).'],
  DAYS: [D, 'end_date, start_date', 'Returns the number of days between two dates.'],
  DAYS360: [D, 'start_date, end_date, [method]', 'Returns the number of days between two dates on a 360-day year.'],
  DEGREES: [M, 'angle', 'Converts radians to degrees.'],
  DOLLAR: [T, 'number, [decimals]', 'Formats a number as currency text.'],
  EDATE: [D, 'start_date, months', 'Returns the date a number of months before or after a date.'],
  EOMONTH: [D, 'start_date, months', 'Returns the last day of the month a number of months away.'],
  EVEN: [M, 'number', 'Rounds a number up to the nearest even integer.'],
  EXACT: [T, 'text1, text2', 'Checks whether two text values are exactly the same (case-sensitive).'],
  EXP: [M, 'number', 'Returns e raised to the power of a number.'],
  FACT: [M, 'number', 'Returns the factorial of a number.'],
  FIND: [T, 'find_text, within_text, [start_num]', 'Finds one text value inside another (case-sensitive).'],
  FIXED: [T, 'number, [decimals], [no_commas]', 'Formats a number as text with a fixed number of decimals.'],
  FLOOR: [M, 'number, significance', 'Rounds a number down to the nearest multiple of significance.'],
  'FLOOR.MATH': [M, 'number, [significance], [mode]', 'Rounds a number down to the nearest integer or multiple of significance.'],
  FORMULATEXT: [R, 'reference', 'Returns the formula of a cell as text.'],
  FV: [F, 'rate, nper, pmt, [pv], [type]', 'Returns the future value of an investment.'],
  GCD: [M, 'number1, [number2], ...', 'Returns the greatest common divisor.'],
  GEOMEAN: [S, 'number1, [number2], ...', 'Returns the geometric mean.'],
  HARMEAN: [S, 'number1, [number2], ...', 'Returns the harmonic mean.'],
  HLOOKUP: [R, 'lookup_value, table_array, row_index_num, [range_lookup]', 'Looks up a value in the top row of a table and returns a value from a given row.'],
  HOUR: [D, 'serial_number', 'Returns the hour (0 to 23) of a time.'],
  IF: [L, 'logical_test, value_if_true, [value_if_false]', 'Returns one value if a condition is TRUE and another if it is FALSE.'],
  IFERROR: [L, 'value, value_if_error', 'Returns value_if_error if the value is an error, otherwise the value.'],
  IFNA: [L, 'value, value_if_na', 'Returns value_if_na if the value is #N/A, otherwise the value.'],
  IFS: [L, 'logical_test1, value_if_true1, [logical_test2, value_if_true2], ...', 'Returns the value for the first condition that is TRUE.'],
  INDEX: [R, 'array, row_num, [column_num]', 'Returns the value at a given row and column of a range.'],
  INDIRECT: [R, 'ref_text, [a1]', 'Returns the reference given by a text string.'],
  INT: [M, 'number', 'Rounds a number down to the nearest integer.'],
  IRR: [F, 'values, [guess]', 'Returns the internal rate of return for a series of cash flows.'],
  ISBLANK: [I, 'value', 'Returns TRUE if the value is empty.'],
  ISERR: [I, 'value', 'Returns TRUE if the value is any error except #N/A.'],
  ISERROR: [I, 'value', 'Returns TRUE if the value is any error.'],
  ISEVEN: [I, 'number', 'Returns TRUE if the number is even.'],
  ISFORMULA: [I, 'reference', 'Returns TRUE if the cell contains a formula.'],
  ISLOGICAL: [I, 'value', 'Returns TRUE if the value is a logical value.'],
  ISNA: [I, 'value', 'Returns TRUE if the value is the #N/A error.'],
  ISNONTEXT: [I, 'value', 'Returns TRUE if the value is not text.'],
  ISNUMBER: [I, 'value', 'Returns TRUE if the value is a number.'],
  ISODD: [I, 'number', 'Returns TRUE if the number is odd.'],
  ISOWEEKNUM: [D, 'date', 'Returns the ISO week number of the year for a date.'],
  ISREF: [I, 'value', 'Returns TRUE if the value is a reference.'],
  ISTEXT: [I, 'value', 'Returns TRUE if the value is text.'],
  LARGE: [S, 'array, k', 'Returns the k-th largest value in a data set.'],
  LCM: [M, 'number1, [number2], ...', 'Returns the least common multiple.'],
  LEFT: [T, 'text, [num_chars]', 'Returns the first characters of a text string.'],
  LEN: [T, 'text', 'Returns the number of characters in a text string.'],
  LN: [M, 'number', 'Returns the natural logarithm of a number.'],
  LOG: [M, 'number, [base]', 'Returns the logarithm of a number to a given base.'],
  LOG10: [M, 'number', 'Returns the base-10 logarithm of a number.'],
  LOOKUP: [R, 'lookup_value, lookup_vector, [result_vector]', 'Looks up a value in a one-row or one-column range.'],
  LOWER: [T, 'text', 'Converts text to lowercase.'],
  MATCH: [R, 'lookup_value, lookup_array, [match_type]', 'Returns the position of a value in a range.'],
  MAX: [S, 'number1, [number2], ...', 'Returns the largest value in a set of values.'],
  MAXIFS: [S, `max_range, ${CRITERIA_PAIRS}`, 'Returns the largest value among cells that meet multiple criteria.'],
  MDETERM: [M, 'array', 'Returns the matrix determinant of an array.'],
  MEDIAN: [S, 'number1, [number2], ...', 'Returns the median of the given numbers.'],
  MID: [T, 'text, start_num, num_chars', 'Returns characters from the middle of a text string.'],
  MIN: [S, 'number1, [number2], ...', 'Returns the smallest value in a set of values.'],
  MINIFS: [S, `min_range, ${CRITERIA_PAIRS}`, 'Returns the smallest value among cells that meet multiple criteria.'],
  MINUTE: [D, 'serial_number', 'Returns the minute (0 to 59) of a time.'],
  MINVERSE: [M, 'array', 'Returns the inverse matrix of an array.'],
  MMULT: [M, 'array1, array2', 'Returns the matrix product of two arrays.'],
  MOD: [M, 'number, divisor', 'Returns the remainder after division.'],
  MODE: [S, 'number1, [number2], ...', 'Returns the most frequent value in a data set.'],
  'MODE.SNGL': [S, 'number1, [number2], ...', 'Returns the most frequent value in a data set.'],
  MONTH: [D, 'serial_number', 'Returns the month (1 to 12) of a date.'],
  MROUND: [M, 'number, multiple', 'Rounds a number to the nearest multiple.'],
  N: [I, 'value', 'Converts a value to a number.'],
  NETWORKDAYS: [D, 'start_date, end_date, [holidays]', 'Returns the number of whole workdays between two dates.'],
  'NETWORKDAYS.INTL': [D, 'start_date, end_date, [weekend], [holidays]', 'Returns the number of workdays between two dates with custom weekends.'],
  NOT: [L, 'logical', 'Reverses a logical value.'],
  NOW: [D, '', 'Returns the current date and time.'],
  NPER: [F, 'rate, pmt, pv, [fv], [type]', 'Returns the number of periods for an investment.'],
  NPV: [F, 'rate, value1, [value2], ...', 'Returns the net present value of periodic cash flows.'],
  NUMBERVALUE: [T, 'text, [decimal_separator], [group_separator]', 'Converts text to a number using the given separators.'],
  ODD: [M, 'number', 'Rounds a number up to the nearest odd integer.'],
  OFFSET: [R, 'reference, rows, cols, [height], [width]', 'Returns a reference offset from a starting reference.'],
  OR: [L, 'logical1, [logical2], ...', 'Returns TRUE if any argument is TRUE.'],
  PERCENTILE: [S, 'array, k', 'Returns the k-th percentile of values in a range.'],
  'PERCENTILE.INC': [S, 'array, k', 'Returns the k-th percentile of values in a range, inclusive.'],
  PERMUT: [M, 'number, number_chosen', 'Returns the number of permutations for a given number of items.'],
  PHONETIC: [T, 'reference', 'Returns the phonetic (furigana) text of a reference.'],
  PI: [M, '', 'Returns the value of pi.'],
  PMT: [F, 'rate, nper, pv, [fv], [type]', 'Returns the periodic payment for a loan.'],
  POWER: [M, 'number, power', 'Returns a number raised to a power.'],
  PRODUCT: [M, 'number1, [number2], ...', 'Multiplies all of its arguments.'],
  PROPER: [T, 'text', 'Capitalizes the first letter of each word.'],
  PV: [F, 'rate, nper, pmt, [fv], [type]', 'Returns the present value of an investment.'],
  QUARTILE: [S, 'array, quart', 'Returns the quartile of a data set.'],
  'QUARTILE.INC': [S, 'array, quart', 'Returns the quartile of a data set, inclusive.'],
  QUOTIENT: [M, 'numerator, denominator', 'Returns the integer portion of a division.'],
  RADIANS: [M, 'angle', 'Converts degrees to radians.'],
  RAND: [M, '', 'Returns a random number between 0 and 1.'],
  RANDBETWEEN: [M, 'bottom, top', 'Returns a random integer between two numbers.'],
  RANK: [S, 'number, ref, [order]', 'Returns the rank of a number in a list.'],
  RATE: [F, 'nper, pmt, pv, [fv], [type], [guess]', 'Returns the interest rate per period of an annuity.'],
  REPLACE: [T, 'old_text, start_num, num_chars, new_text', 'Replaces part of a text string by position.'],
  REPT: [T, 'text, number_times', 'Repeats text a given number of times.'],
  RIGHT: [T, 'text, [num_chars]', 'Returns the last characters of a text string.'],
  ROUND: [M, 'number, num_digits', 'Rounds a number to a given number of digits.'],
  ROUNDDOWN: [M, 'number, num_digits', 'Rounds a number down, toward zero.'],
  ROUNDUP: [M, 'number, num_digits', 'Rounds a number up, away from zero.'],
  ROW: [R, '[reference]', 'Returns the row number of a reference.'],
  ROWS: [R, 'array', 'Returns the number of rows in a reference or array.'],
  SEARCH: [T, 'find_text, within_text, [start_num]', 'Finds one text value inside another (not case-sensitive, wildcards allowed).'],
  SECOND: [D, 'serial_number', 'Returns the second (0 to 59) of a time.'],
  SEQUENCE: [M, 'rows, [columns], [start], [step]', 'Returns a sequence of numbers.'],
  SIGN: [M, 'number', 'Returns the sign of a number: 1, 0 or -1.'],
  SIN: [M, 'number', 'Returns the sine of an angle given in radians.'],
  SLN: [F, 'cost, salvage, life', 'Returns the straight-line depreciation of an asset for one period.'],
  SMALL: [S, 'array, k', 'Returns the k-th smallest value in a data set.'],
  SQRT: [M, 'number', 'Returns the positive square root of a number.'],
  STDEV: [S, 'number1, [number2], ...', 'Estimates standard deviation based on a sample.'],
  'STDEV.P': [S, 'number1, [number2], ...', 'Returns standard deviation based on the entire population.'],
  'STDEV.S': [S, 'number1, [number2], ...', 'Estimates standard deviation based on a sample.'],
  STDEVP: [S, 'number1, [number2], ...', 'Returns standard deviation based on the entire population.'],
  SUBSTITUTE: [T, 'text, old_text, new_text, [instance_num]', 'Replaces existing text with new text.'],
  SUBTOTAL: [M, 'function_num, ref1, [ref2], ...', 'Returns a subtotal (SUM, AVERAGE, COUNT and so on) of a list.'],
  SUM: [M, 'number1, [number2], ...', 'Adds its arguments.'],
  SUMIF: [M, 'range, criteria, [sum_range]', 'Adds the cells that meet a criterion.'],
  SUMIFS: [M, `sum_range, ${CRITERIA_PAIRS}`, 'Adds the cells that meet multiple criteria.'],
  SUMPRODUCT: [M, 'array1, [array2], ...', 'Returns the sum of the products of corresponding array items.'],
  SUMSQ: [M, 'number1, [number2], ...', 'Returns the sum of the squares of its arguments.'],
  SWITCH: [L, 'expression, value1, result1, [default_or_value2, result2], ...', 'Compares an expression with a list of values and returns the matching result.'],
  T: [T, 'value', 'Returns the text if the value is text, otherwise empty text.'],
  TAN: [M, 'number', 'Returns the tangent of an angle given in radians.'],
  TEXT: [T, 'value, format_text', 'Formats a number as text using a format code.'],
  TEXTAFTER: [T, `text, delimiter, ${TEXT_SPLIT_TAIL}`, 'Returns the text after a delimiter.'],
  TEXTBEFORE: [T, `text, delimiter, ${TEXT_SPLIT_TAIL}`, 'Returns the text before a delimiter.'],
  TEXTJOIN: [T, 'delimiter, ignore_empty, text1, [text2], ...', 'Joins text items with a delimiter.'],
  TEXTSPLIT: [T, 'text, col_delimiter, [row_delimiter], [ignore_empty], [match_mode], [pad_with]', 'Splits text into columns and rows by delimiters.'],
  TIME: [D, 'hour, minute, second', 'Returns the serial number of a time.'],
  TIMEVALUE: [D, 'time_text', 'Converts a time stored as text to a serial number.'],
  TODAY: [D, '', 'Returns the current date.'],
  TRANSPOSE: [R, 'array', 'Swaps the rows and columns of an array.'],
  TRIM: [T, 'text', 'Removes extra spaces from text.'],
  TRUNC: [M, 'number, [num_digits]', 'Truncates a number to an integer or given precision.'],
  TYPE: [I, 'value', 'Returns a number for the data type of a value.'],
  UPPER: [T, 'text', 'Converts text to uppercase.'],
  VALUE: [T, 'text', 'Converts text that looks like a number to a number.'],
  VAR: [S, 'number1, [number2], ...', 'Estimates variance based on a sample.'],
  'VAR.P': [S, 'number1, [number2], ...', 'Returns variance based on the entire population.'],
  'VAR.S': [S, 'number1, [number2], ...', 'Estimates variance based on a sample.'],
  VARP: [S, 'number1, [number2], ...', 'Returns variance based on the entire population.'],
  VLOOKUP: [R, 'lookup_value, table_array, col_index_num, [range_lookup]', 'Looks up a value in the first column of a table and returns a value from a given column.'],
  WEEKDAY: [D, 'serial_number, [return_type]', 'Returns the day of the week for a date.'],
  WEEKNUM: [D, 'serial_number, [return_type]', 'Returns the week number of the year for a date.'],
  WORKDAY: [D, 'start_date, days, [holidays]', 'Returns the date a number of workdays away.'],
  'WORKDAY.INTL': [D, 'start_date, days, [weekend], [holidays]', 'Returns the date a number of workdays away, with custom weekends.'],
  XLOOKUP: [R, 'lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode]', 'Searches a range and returns the matching item from another range.'],
  XMATCH: [R, 'lookup_value, lookup_array, [match_mode], [search_mode]', 'Returns the position of an item in a range.'],
  XOR: [L, 'logical1, [logical2], ...', 'Returns TRUE if an odd number of arguments are TRUE.'],
  YEAR: [D, 'serial_number', 'Returns the year of a date.'],
  YEARFRAC: [D, 'start_date, end_date, [basis]', 'Returns the fraction of a year between two dates.'],
};

/** Parse "a, [b], [c, d], ..." into args plus the repeating group start. */
export function parseFunctionSignature(argText: string): { args: IFormulaFunctionArg[]; repeatStart?: number } {
  const args: IFormulaFunctionArg[] = [];
  let repeatStart: number | undefined;
  let groupStart = -1;
  let lastGroupStart = -1;
  let inGroup = false;
  for (const raw of argText.split(',')) {
    let part = raw.trim();
    if (!part) continue;
    if (part === '...') {
      repeatStart = lastGroupStart >= 0 ? lastGroupStart : Math.max(0, args.length - 1);
      continue;
    }
    let optional = inGroup;
    if (part.startsWith('[')) {
      part = part.slice(1);
      inGroup = true;
      optional = true;
      groupStart = args.length;
    }
    if (part.endsWith(']')) {
      part = part.slice(0, -1);
      inGroup = false;
      lastGroupStart = groupStart;
    }
    args.push({ name: part.trim(), optional });
  }
  return repeatStart === undefined ? { args } : { args, repeatStart };
}

function formatArgs(meta: Pick<IFormulaFunctionMetadata, 'args' | 'repeatStart'>): string[] {
  const parts = meta.args.map((a) => (a.optional ? `[${a.name}]` : a.name));
  if (meta.repeatStart !== undefined) parts.push('...');
  return parts;
}

function buildMetadata(name: string, category: FormulaFunctionCategory, argText: string, description: string): IFormulaFunctionMetadata {
  const parsed = parseFunctionSignature(argText);
  const meta: IFormulaFunctionMetadata = { name, description, category, args: parsed.args, signature: '' };
  if (parsed.repeatStart !== undefined) meta.repeatStart = parsed.repeatStart;
  meta.signature = `${name}(${formatArgs(meta).join(', ')})`;
  return meta;
}

/** Fallback argument text from a custom function's arity: "value1, [value2], ...". */
function fallbackArgText(fn: Pick<IFormulaFunction, 'minArgs' | 'maxArgs'>): string {
  const { minArgs, maxArgs } = fn;
  const parts: string[] = [];
  const fixed = maxArgs < 0 ? Math.max(minArgs, 1) : maxArgs;
  for (let i = 0; i < fixed; i++) {
    const name = fixed === 1 && maxArgs >= 0 ? 'value' : `value${i + 1}`;
    parts.push(i < minArgs ? name : `[${name}]`);
  }
  if (maxArgs < 0) {
    parts.push(`[value${fixed + 1}]`, '...');
  }
  return parts.join(', ');
}

let builtInCache: Map<string, IFormulaFunctionMetadata> | null = null;

function builtIns(): Map<string, IFormulaFunctionMetadata> {
  if (!builtInCache) {
    builtInCache = new Map();
    for (const name of Object.keys(BUILT_INS)) {
      const [category, argText, description] = BUILT_INS[name] as Entry;
      builtInCache.set(name, buildMetadata(name, category, argText, description));
    }
  }
  return builtInCache;
}

type CustomFunctions = Record<string, IFormulaFunction> | undefined;

function customMetadata(name: string, fn: IFormulaFunction): IFormulaFunctionMetadata {
  return buildMetadata(name, 'Custom', fn.signature ?? fallbackArgText(fn), fn.description ?? 'Custom function.');
}

/**
 * Metadata for a function by name (case-insensitive). Custom functions win
 * over built-ins of the same name, as they do in the engine.
 */
export function getFunctionMetadata(name: string, customFunctions?: CustomFunctions): IFormulaFunctionMetadata | undefined {
  const upper = name.toUpperCase();
  if (customFunctions) {
    for (const key of Object.keys(customFunctions)) {
      if (key.toUpperCase() === upper) return customMetadata(upper, customFunctions[key] as IFormulaFunction);
    }
  }
  return builtIns().get(upper);
}

/** All function metadata (built-ins plus custom functions), sorted by name. */
export function listFunctions(customFunctions?: CustomFunctions): IFormulaFunctionMetadata[] {
  const all = new Map(builtIns());
  if (customFunctions) {
    for (const key of Object.keys(customFunctions)) {
      const upper = key.toUpperCase();
      all.set(upper, customMetadata(upper, customFunctions[key] as IFormulaFunction));
    }
  }
  return [...all.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * Which entry of `meta.args` the argument at `argIndex` corresponds to,
 * folding indexes past the end into the repeating group. -1 when the
 * function takes no argument at that position.
 */
export function resolveArgumentIndex(meta: Pick<IFormulaFunctionMetadata, 'args' | 'repeatStart'>, argIndex: number): number {
  if (argIndex < 0) return -1;
  if (argIndex < meta.args.length) return argIndex;
  if (meta.repeatStart === undefined) return -1;
  const groupLen = meta.args.length - meta.repeatStart;
  if (groupLen <= 0) return -1;
  return meta.repeatStart + ((argIndex - meta.repeatStart) % groupLen);
}

/** A piece of a signature for rendering, with the current argument flagged. */
export interface IFormulaSignaturePart {
  text: string;
  /** True for the argument the caret is in (render it bold). */
  active: boolean;
  /** True for argument names (false for punctuation and the function name). */
  isArg: boolean;
}

/**
 * Split a signature into parts for an argument hint:
 * `SUMIFS(` `sum_range` `, ` `criteria_range1` ... `)`, with the argument at
 * `argIndex` flagged active.
 */
export function getSignatureParts(meta: IFormulaFunctionMetadata, argIndex: number): IFormulaSignaturePart[] {
  const active = resolveArgumentIndex(meta, argIndex);
  const parts: IFormulaSignaturePart[] = [{ text: `${meta.name}(`, active: false, isArg: false }];
  const args = formatArgs(meta);
  args.forEach((text, i) => {
    if (i > 0) parts.push({ text: ', ', active: false, isArg: false });
    parts.push({ text, active: i === active, isArg: true });
  });
  parts.push({ text: ')', active: false, isArg: false });
  return parts;
}
