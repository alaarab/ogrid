/**
 * Formula system — barrel export.
 */

// Core types
export type {
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
  IFormulaContext,
  IFormulaFunction,
  IEvaluator,
  IRecalcResult,
  IFormulaEngineConfig,
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
} from './cellAddressUtils';

// Tokenizer
export { tokenize } from './tokenizer';

// Parser
export { parse } from './parser';

// Evaluator
export {
  FormulaEvaluator,
  toNumber,
  toString,
  toString as formulaToString,
  toBoolean,
  flattenArgs,
} from './evaluator';

// Dependency graph
export { DependencyGraph } from './dependencyGraph';

// Formula engine
export { FormulaEngine } from './formulaEngine';

// Built-in functions registry
export { createBuiltInFunctions } from './functions';

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
