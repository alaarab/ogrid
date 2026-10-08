/**
 * Formula system  -  barrel export.
 */

// Core types
export type {
  ISpillRange,
  ICellAddress,
  ICellRange,
  CellKey,
  FormulaErrorType,
  TokenType,
  Token,
  ASTNode,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  CellRefNode,
  RangeNode,
  FunctionCallNode,
  BinaryOp,
  BinaryOpNode,
  UnaryOpNode,
  ErrorNode,
  NameNode,
  IFormulaContext,
  IDetachedEvaluationOptions,
  IFormulaFunction,
  IEvaluator,
  IRecalcResult,
  IFormulaEngineConfig,
  IFormulaLimits,
  IGridDataAccessor,
  INamedRange,
  IAuditEntry,
  IAuditTrail,
} from './types';

// FormulaError class
export { FormulaError } from './types';

// Error constants and helper
export {
  REF_ERROR,
  DIV_ZERO_ERROR,
  VALUE_ERROR,
  NAME_ERROR,
  CIRC_ERROR,
  GENERAL_ERROR,
  NA_ERROR,
  isFormulaError,
} from './errors';

// Cell address utilities
export {
  columnLetterToIndex,
  parseCellRef,
  parseRange,
  formatAddress,
  toCellKey,
  fromCellKey,
  adjustFormulaReferences,
  shiftFormulaReferences,
  shiftFormulaCells,
} from './cellAddressUtils';
export type { StructureAxis } from './cellAddressUtils';

// Tokenizer
export { tokenize } from './tokenizer';

// Parser
export { parse } from './parser';

// Evaluator
export {
  FormulaEvaluator,
  toNumber,
  toText,
  // Back-compat aliases for the pre-rename export names.
  toText as toString,
  toText as formulaToString,
  toBoolean,
  flattenArgs,
} from './evaluator';

// Dependency graph
export { DependencyGraph } from './dependencyGraph';
export type { IRangeDependency } from './dependencyGraph';

// Formula engine
export { FormulaEngine } from './formulaEngine';

// Built-in functions registry
export { createBuiltInFunctions } from './functions';

// Function metadata + formula editing help (autocomplete, argument hints)
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

// Formula bar helpers (depend on tokenizer, bundled with formula subpath)
export {
  extractFormulaReferences,
  processFormulaBarCommit,
  deriveFormulaBarText,
  handleFormulaBarKeyDown,
  canInsertReference,
  insertReferenceAtCursor,
} from '../utils/formulaBarHelpers';
export type { FormulaReference } from '../utils/formulaBarHelpers';

// Formula bar constants
export { FORMULA_REF_COLORS, FORMULA_BAR_CSS, FORMULA_BAR_STYLES } from '../constants/formulaBar';
