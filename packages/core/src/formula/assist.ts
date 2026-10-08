/**
 * Formula editing help  -  function metadata, autocomplete and argument hints.
 *
 * Also exported from `@alaarab/ogrid-core/formula`. This separate entry
 * (`@alaarab/ogrid-core/formula/assist`) lets UI packages load the function
 * descriptions lazily, the first time a formula grid needs them, instead of
 * shipping them with every grid.
 */
export {
  getFunctionMetadata,
  listFunctions,
  parseFunctionSignature,
  resolveArgumentIndex,
  getSignatureParts,
} from './functionMetadata';
export type {
  FormulaFunctionCategory,
  IFormulaFunctionArg,
  IFormulaFunctionMetadata,
  IFormulaSignaturePart,
} from './functionMetadata';
export { getFormulaCaretContext, getFormulaCompletions, applyFormulaCompletion } from './formulaAutocomplete';
export type {
  IFormulaCaretContext,
  IFormulaCaretToken,
  IFormulaCaretCall,
  IFormulaCompletion,
} from './formulaAutocomplete';
