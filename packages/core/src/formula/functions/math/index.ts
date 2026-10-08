import type { IFormulaFunction } from '../../types';
import { registerMathAggregationFunctions } from './aggregation';
import { registerMathRoundingFunctions } from './rounding';
import { registerMathArithmeticFunctions } from './arithmetic';
import { registerMathCombinatoricsFunctions } from './combinatorics';
import { registerMathTrigFunctions } from './trig';

/**
 * Registers all math formula functions (SUM, ROUND, POWER, COMBIN, ...).
 * Composed from focused category modules so each group stays small and navigable:
 *  - aggregation:   sums/averages/min-max/ranking over lists and ranges
 *  - rounding:      ROUND/CEILING/FLOOR/TRUNC/MROUND family
 *  - arithmetic:    elementary ops, powers, logs, constants/random
 *  - combinatorics: COMBIN/PERMUT/FACT/GCD/LCM
 *  - trig:          SIN/COS/TAN and inverses, RADIANS/DEGREES, LOG10
 */
export function registerMathFunctions(registry: Map<string, IFormulaFunction>): void {
  registerMathAggregationFunctions(registry);
  registerMathRoundingFunctions(registry);
  registerMathArithmeticFunctions(registry);
  registerMathCombinatoricsFunctions(registry);
  registerMathTrigFunctions(registry);
}
