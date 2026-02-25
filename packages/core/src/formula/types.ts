/**
 * Formula system type definitions.
 */

// --- Cell Addressing ---

/** A parsed cell address. Row and column are 0-based internally. */
export interface ICellAddress {
  col: number;
  row: number;
  absCol: boolean;
  absRow: boolean;
  /** Sheet name for cross-sheet references. Undefined = current sheet. */
  sheet?: string;
}

/** A rectangular range of cells. */
export interface ICellRange {
  start: ICellAddress;
  end: ICellAddress;
}

/** String key for a cell: "col,row" for internal Map storage. */
export type CellKey = string;

// --- Formula Errors ---

export type FormulaErrorType =
  | '#REF!'
  | '#DIV/0!'
  | '#VALUE!'
  | '#NAME?'
  | '#CIRC!'
  | '#ERROR!'
  | '#N/A'
  | '#NUM!';

export class FormulaError {
  constructor(
    public readonly type: FormulaErrorType,
    public readonly message?: string
  ) {}
  toString(): string {
    return this.type;
  }
}

// --- Tokens ---

export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'CELL_REF'
  | 'FUNCTION'
  | 'IDENTIFIER'
  | 'SHEET_REF'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'COLON'
  | 'PLUS'
  | 'MINUS'
  | 'MULTIPLY'
  | 'DIVIDE'
  | 'POWER'
  | 'PERCENT'
  | 'AMPERSAND'
  | 'GT'
  | 'LT'
  | 'GTE'
  | 'LTE'
  | 'EQ'
  | 'NEQ'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// --- AST Nodes ---

export type ASTNode =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | CellRefNode
  | RangeNode
  | FunctionCallNode
  | BinaryOpNode
  | UnaryOpNode
  | ErrorNode;

export interface NumberLiteral {
  kind: 'number';
  value: number;
}

export interface StringLiteral {
  kind: 'string';
  value: string;
}

export interface BooleanLiteral {
  kind: 'boolean';
  value: boolean;
}

export interface CellRefNode {
  kind: 'cellRef';
  address: ICellAddress;
  raw: string;
}

export interface RangeNode {
  kind: 'range';
  start: ICellAddress;
  end: ICellAddress;
  raw: string;
}

export interface FunctionCallNode {
  kind: 'functionCall';
  name: string;
  args: ASTNode[];
}

export type BinaryOp =
  | '+' | '-' | '*' | '/' | '^' | '%' | '&'
  | '>' | '<' | '>=' | '<=' | '=' | '<>';

export interface BinaryOpNode {
  kind: 'binaryOp';
  op: BinaryOp;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOpNode {
  kind: 'unaryOp';
  op: '+' | '-';
  operand: ASTNode;
}

export interface ErrorNode {
  kind: 'error';
  error: FormulaError;
}

// --- Function Registry ---

/** Context passed to formula functions during evaluation. */
export interface IFormulaContext {
  getCellValue(address: ICellAddress): unknown;
  getRangeValues(range: ICellRange): unknown[][];
  now(): Date;
}

/** A registered formula function. */
export interface IFormulaFunction {
  minArgs: number;
  maxArgs: number;
  /** Functions receive raw AST nodes so they can handle ranges specially. */
  evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown;
}

/** The evaluator interface that functions can call back into. */
export interface IEvaluator {
  evaluate(node: ASTNode, context: IFormulaContext): unknown;
}

// --- Formula Engine API ---

/** Result of a cell change: which cells were recalculated. */
export interface IRecalcResult {
  updatedCells: Array<{
    cellKey: CellKey;
    col: number;
    row: number;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

/** Configuration for the FormulaEngine. */
export interface IFormulaEngineConfig {
  maxChainLength?: number;
  customFunctions?: Record<string, IFormulaFunction>;
  /** Named ranges: name → cell/range reference string (e.g. "A1:B10"). */
  namedRanges?: Record<string, string>;
}

/** Grid data accessor — bridge between FormulaEngine and the grid's data model. */
export interface IGridDataAccessor {
  getCellValue(col: number, row: number): unknown;
  getRowCount(): number;
  getColumnCount(): number;
}

// --- Named Ranges ---

/** A named range definition. */
export interface INamedRange {
  name: string;
  /** Cell or range reference string, e.g. "A1" or "A1:B10". */
  ref: string;
}

// --- Formula Auditing ---

/** A single cell entry in an audit trail. */
export interface IAuditEntry {
  cellKey: CellKey;
  col: number;
  row: number;
  formula?: string;
  value: unknown;
}

/** Full audit trail for a cell: its precedents and dependents. */
export interface IAuditTrail {
  target: IAuditEntry;
  /** All cells that this cell depends on (deep, transitive). */
  precedents: IAuditEntry[];
  /** All cells that depend on this cell (deep, transitive). */
  dependents: IAuditEntry[];
}
