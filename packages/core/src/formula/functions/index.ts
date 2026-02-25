import type { IFormulaFunction } from '../types';
import { registerMathFunctions } from './math';
import { registerLogicalFunctions } from './logical';
import { registerLookupFunctions } from './lookup';
import { registerTextFunctions } from './text';
import { registerDateFunctions } from './date';
import { registerStatsFunctions } from './stats';
import { registerInfoFunctions } from './info';

export function createBuiltInFunctions(): Map<string, IFormulaFunction> {
  const registry = new Map<string, IFormulaFunction>();
  registerMathFunctions(registry);
  registerLogicalFunctions(registry);
  registerLookupFunctions(registry);
  registerTextFunctions(registry);
  registerDateFunctions(registry);
  registerStatsFunctions(registry);
  registerInfoFunctions(registry);
  return registry;
}
