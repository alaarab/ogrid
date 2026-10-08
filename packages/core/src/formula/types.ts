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
  | '#NUM!'
  | '#SPILL!'
  | '#CALC!';

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
  | 'ERROR_LITERAL'
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
  | 'AT'
  | 'HASH'
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
  | ErrorNode
  | NameNode
  | SpillRefNode
  | ValueNode;

export interface ValueNode {
  kind: 'value';
  value: unknown;
}

export interface SpillRefNode {
  kind: 'spillRef';
  address: ICellAddress;
}

/** Successful spill, including its formula anchor (0-based sheet coordinates). */
export interface ISpillRange {
  anchorCol: number;
  anchorRow: number;
  endCol: number;
  endRow: number;
}

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
  op: '+' | '-' | '@';
  operand: ASTNode;
}

export interface ErrorNode {
  kind: 'error';
  error: FormulaError;
}

/** A name bound by LET (uppercased). Only produced inside a LET call. */
export interface NameNode {
  kind: 'name';
  name: string;
}

// --- Function Registry ---

/** Context passed to formula functions during evaluation. */
export interface IFormulaContext {
  getCellValue(address: ICellAddress): unknown;
  getRangeValues(range: ICellRange): unknown[][];
  /** Preserve blank rows/columns for an array expression; aggregations may clip reads. */
  getArrayRangeValues?(range: ICellRange): unknown[][];
  now(): Date;
  /** Resolve the array owned by a spill anchor, or #REF! when it has no spill. */
  getSpillValues?(address: ICellAddress): unknown;
  /** Resolve a spill anchor to a sheet-qualified range, preserving reference geometry. */
  getSpillRange?(address: ICellAddress): ICellRange | FormulaError;
  /** Address of the formula being evaluated, when supplied by the engine. */
  currentCell?: ICellAddress;
  /** Optional shared work budget for built-in functions. */
  consumeWork?(steps: number): void;
  /** Maximum size of a generated array; supplied by the evaluator. */
  maxArrayCells?: number;
  /** Optional: return the formula string for a cell, or undefined if not a formula cell. */
  getCellFormula?(address: ICellAddress): string | undefined;
  /** Optional: whether a row is hidden (SUBTOTAL 101-111 skip hidden rows). `sheet` names another sheet. */
  isRowHidden?(row: number, sheet?: string): boolean;
}

/** A registered formula function. */
export interface IFormulaFunction {
  minArgs: number;
  maxArgs: number;
  /** Functions receive raw AST nodes so they can handle ranges specially. */
  evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown;
  /** One-line description shown by formula autocomplete (custom functions). */
  description?: string;
  /**
   * Argument list for the argument hint, in Excel notation: "value, [precision]"
   * or "number1, [number2], ...". Defaults to names derived from minArgs/maxArgs.
   */
  signature?: string;
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
  /** Current successful spills after recalculation, for serialization. */
  spillRanges?: ISpillRange[];
}

/**
 * A recalculation plan: the topologically ordered cells to recompute, plus the
 * subset that participates in a dependency cycle and must be marked #CIRC!.
 */
export interface IRecalcPlan {
  order: CellKey[];
  cyclic: ReadonlySet<CellKey>;
}

/** Configuration for the FormulaEngine. */
/**
 * Per-formula resource limits. A formula that exceeds one evaluates to #VALUE!.
 * The defaults suit large grids; lower them for untrusted imported workbooks.
 */
export interface IFormulaLimits {
  /** Cells a single formula may read from ranges, after clipping to the data. Default 5,000,000. */
  maxRangeCells?: number;
  /** Work budget for a single formula: cells read, nodes evaluated and text scanned. Default 20,000,000. */
  maxWork?: number;
}

export interface IFormulaEngineConfig {
  /**
   * @deprecated No longer used. Circular references are now detected exactly by
   * the dependency graph's topological sort, so no chain-length heuristic is
   * needed. Accepted for backwards compatibility and ignored.
   */
  maxChainLength?: number;
  customFunctions?: Record<string, IFormulaFunction>;
  /** Named ranges: name  to  cell/range reference string (e.g. "A1:B10"). */
  namedRanges?: Record<string, string>;
  /** Per-formula resource limits (range size, work budget). */
  limits?: IFormulaLimits;
}

/** Grid data accessor  -  bridge between FormulaEngine and the grid's data model. */
export interface IGridDataAccessor {
  getCellValue(col: number, row: number): unknown;
  getRowCount(): number;
  getColumnCount(): number;
  /** True for every cell in a merged block, including its master. */
  isCellMerged?(col: number, row: number): boolean;
  /** Successful spill at this anchor, in this accessor's sheet coordinates. */
  getSpillRange?(col: number, row: number): ISpillRange | undefined;
  /** Optional: whether a sheet row is hidden. SUBTOTAL 101-111 leave hidden rows out. */
  isRowHidden?(row: number): boolean;
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
