import type { IFormulaFunction } from '../types';
import { registerMathFunctions } from './math';
import { registerLogicalFunctions } from './logical';
import { registerLookupFunctions } from './lookup';
import { registerTextFunctions } from './text';
import { registerDateFunctions } from './date';
import { registerStatsFunctions } from './stats';
import { registerInfoFunctions } from './info';
import { registerFinancialFunctions } from './financial';
import { registerStatisticalExtendedFunctions } from './statistical-extended';
import { registerDynamicArrayFunctions } from './dynamicArrays';
import { registerReferenceFunctions } from './reference';

export function createBuiltInFunctions(): Map<string, IFormulaFunction> {
  const registry = new Map<string, IFormulaFunction>();
  registerMathFunctions(registry);
  registerLogicalFunctions(registry);
  registerLookupFunctions(registry);
  registerTextFunctions(registry);
  registerDateFunctions(registry);
  registerStatsFunctions(registry);
  registerInfoFunctions(registry);
  registerFinancialFunctions(registry);
  registerStatisticalExtendedFunctions(registry);
  registerReferenceFunctions(registry);
  registerDynamicArrayFunctions(registry);
  return registry;
}
