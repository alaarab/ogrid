import type { IColumnDef, IValueParserParams } from '../types/columnTypes';
/**
 * Result of parsing a cell value. When `valid` is false the change should be skipped.
 */
export interface ParseValueResult {
    valid: boolean;
    value: unknown;
}
/**
 * Run the column's valueParser (if any), or auto-validate select columns.
 * Returns `{ valid: true, value }` with the parsed value, or `{ valid: false }` to reject.
 */
export declare function parseValue<T>(newValue: unknown, oldValue: unknown, item: T, col: IColumnDef<T>): ParseValueResult;
/**
 * Parses a value as a number. Strips whitespace and commas.
 * Returns `undefined` (reject) if result is NaN.
 */
export declare function numberParser<T>(params: IValueParserParams<T>): unknown;
/**
 * Parses a currency string. Strips currency symbols ($, €, £, ¥), whitespace, commas.
 * Returns `undefined` (reject) if result is NaN.
 */
export declare function currencyParser<T>(params: IValueParserParams<T>): unknown;
/**
 * Parses a date string via `new Date()`. Returns ISO string or `undefined` if invalid.
 */
export declare function dateParser<T>(params: IValueParserParams<T>): unknown;
/**
 * Validates an email address with a basic regex.
 * Returns the trimmed string or `undefined` if invalid.
 */
export declare function emailParser<T>(params: IValueParserParams<T>): unknown;
/**
 * Parses boolean-like values: true/false/yes/no/1/0.
 * Returns `undefined` if not recognized.
 */
export declare function booleanParser<T>(params: IValueParserParams<T>): unknown;
