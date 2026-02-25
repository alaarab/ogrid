/**
 * Formula error constants for convenient usage.
 */

import { FormulaError } from './types';
import type { FormulaErrorType } from './types';

export { FormulaError, type FormulaErrorType };

export const REF_ERROR = new FormulaError('#REF!', 'Invalid cell reference');
export const DIV_ZERO_ERROR = new FormulaError('#DIV/0!', 'Division by zero');
export const VALUE_ERROR = new FormulaError('#VALUE!', 'Wrong value type');
export const NAME_ERROR = new FormulaError('#NAME?', 'Unknown function or name');
export const CIRC_ERROR = new FormulaError('#CIRC!', 'Circular reference');
export const GENERAL_ERROR = new FormulaError('#ERROR!', 'Formula error');
export const NA_ERROR = new FormulaError('#N/A', 'No match found');

/** Check if a value is a FormulaError instance. */
export function isFormulaError(value: unknown): value is FormulaError {
  return value instanceof FormulaError;
}
