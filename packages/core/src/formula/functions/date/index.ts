import type { IFormulaFunction } from '../../types';
import { registerDateComponentFunctions } from './components';
import { registerDateArithmeticFunctions } from './arithmetic';

/**
 * Registers all date/time formula functions (TODAY, YEAR, DATEDIF, WORKDAY, ...).
 * Composed from focused category modules so each group stays small and navigable:
 *  - components: date/time part access, construction, and parsing
 *  - arithmetic: differences, EDATE/EOMONTH, and business-day calculations
 * Shared date helpers live in ./shared.
 */
export function registerDateFunctions(registry: Map<string, IFormulaFunction>): void {
  registerDateComponentFunctions(registry);
  registerDateArithmeticFunctions(registry);
}
