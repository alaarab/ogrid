import type { IFormulaFunction } from '../../types';
import { registerBasicTextFunctions } from './basic';
import { registerTextSearchFunctions } from './search';
import { registerTextFormatFunctions } from './format';

/**
 * Registers all text/string formula functions (CONCATENATE, LEFT, FIND, TEXT, ...).
 * Composed from focused category modules so each group stays small and navigable:
 *  - basic:  core string manipulation (case, slice, trim, length, repeat)
 *  - search: substring find/replace (SUBSTITUTE, FIND, SEARCH, REPLACE)
 *  - format: char/number conversion and number-to-text formatting
 */
export function registerTextFunctions(registry: Map<string, IFormulaFunction>): void {
  registerBasicTextFunctions(registry);
  registerTextSearchFunctions(registry);
  registerTextFormatFunctions(registry);
}
