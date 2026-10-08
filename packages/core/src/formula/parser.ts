/**
 * Recursive descent parser: converts Token[] to an ASTNode.
 *
 * Grammar (precedence low  to  high):
 *   expression      to  comparison
 *   comparison      to  concat (('>' | '<' | '>=' | '<=' | '=' | '<>') concat)*
 *   concat          to  addition ('&' addition)*
 *   addition        to  multiplication (('+' | '-') multiplication)*
 *   multiplication  to  power (('*' | '/') power)*
 *   power           to  unary ('^' unary)*
 *   unary           to  ('-' | '+') unary | postfix
 *   postfix         to  primary '%'?
 *   primary         to  NUMBER | STRING | BOOLEAN | cellRefOrRange | functionCall
 *                   | '(' expression ')'
 *   cellRefOrRange  to  CELL_REF (':' CELL_REF)?
 *   functionCall    to  FUNCTION '(' (expression (',' expression)*)? ')'
 */

import type { Token, ASTNode, BinaryOp, FormulaErrorType } from './types';
import { FormulaError } from './types';
import { MAX_FORMULA_DEPTH } from './limits';
import { parseCellRef } from './cellAddressUtils';
import { tokenize } from './tokenizer';

/**
 * Parse an array of tokens into an AST.
 * Never throws  -  returns an ErrorNode on parse errors.
 *
 * @param tokens - The token array from the tokenizer.
 * @param namedRanges - Optional map of named ranges (name  to  ref string like "A1:B10").
 */
export function parse(tokens: Token[], namedRanges?: Map<string, string>): ASTNode {
  let pos = 0;
  let depth = 0;
  /** Names bound by enclosing LET calls; they shadow named ranges. */
  const letScopes: Set<string>[] = [];
  // --- Token helpers ---

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function advance(): Token | undefined {
    const token = tokens[pos];
    pos++;
    return token;
  }

  function expect(type: Token['type']): Token | null {
    const token = peek();
    if (token && token.type === type) {
      advance();
      return token;
    }
    return null;
  }

  function errorNode(message: string): ASTNode {
    return { kind: 'error', error: new FormulaError('#ERROR!', message) };
  }

  // --- Grammar rules ---

  function expression(): ASTNode {
    if (++depth > MAX_FORMULA_DEPTH) throw new FormulaError('#VALUE!', 'Formula too deep');
    try { return comparison(); } finally { depth--; }
  }

  function comparison(): ASTNode {
    let left = concat();

    for (;;) {
      const t = peek();
      if (!t) break;
      let op: BinaryOp | null = null;
      if (t.type === 'GT') op = '>';
      else if (t.type === 'LT') op = '<';
      else if (t.type === 'GTE') op = '>=';
      else if (t.type === 'LTE') op = '<=';
      else if (t.type === 'EQ') op = '=';
      else if (t.type === 'NEQ') op = '<>';
      else break;

      advance();
      const right = concat();
      left = { kind: 'binaryOp', op, left, right };
    }

    return left;
  }

  function concat(): ASTNode {
    let left = addition();

    while (peek()?.type === 'AMPERSAND') {
      advance();
      const right = addition();
      left = { kind: 'binaryOp', op: '&', left, right };
    }

    return left;
  }

  function addition(): ASTNode {
    let left = multiplication();

    for (;;) {
      const t = peek();
      if (!t) break;
      let op: BinaryOp | null = null;
      if (t.type === 'PLUS') op = '+';
      else if (t.type === 'MINUS') op = '-';
      else break;

      advance();
      const right = multiplication();
      left = { kind: 'binaryOp', op, left, right };
    }

    return left;
  }

  function multiplication(): ASTNode {
    let left = power();

    for (;;) {
      const t = peek();
      if (!t) break;
      let op: BinaryOp | null = null;
      if (t.type === 'MULTIPLY') op = '*';
      else if (t.type === 'DIVIDE') op = '/';
      else break;

      advance();
      const right = power();
      left = { kind: 'binaryOp', op, left, right };
    }

    return left;
  }

  function power(): ASTNode {
    let left = unary();

    while (peek()?.type === 'POWER') {
      advance();
      const right = unary();
      left = { kind: 'binaryOp', op: '^', left, right };
    }

    return left;
  }

  function unary(): ASTNode {
    const t = peek();

    if (t && (t.type === 'MINUS' || t.type === 'PLUS' || t.type === 'AT')) {
      const op = t.type === 'MINUS' ? '-' : t.type === 'AT' ? '@' : '+';
      advance();
      if (++depth > MAX_FORMULA_DEPTH) throw new FormulaError('#VALUE!', 'Formula too deep');
      let operand: ASTNode;
      try { operand = unary(); } finally { depth--; }
      return { kind: 'unaryOp', op, operand };
    }

    return postfix();
  }

  function postfix(): ASTNode {
    let node = primary();

    if (peek()?.type === 'HASH') {
      advance();
      if (node.kind !== 'cellRef') return errorNode('Spill operator requires a cell reference');
      node = { kind: 'spillRef', address: node.address };
    }

    if (peek()?.type === 'PERCENT') {
      advance();
      node = { kind: 'binaryOp', op: '%', left: node, right: { kind: 'number', value: 100 } };
    }

    return node;
  }

  function primary(): ASTNode {
    const t = peek();

    if (!t || t.type === 'EOF') {
      return errorNode('Unexpected end of expression');
    }

    if (t.type === 'ERROR_LITERAL') {
      advance();
      return { kind: 'error', error: new FormulaError(t.value as FormulaErrorType) };
    }

    // Number literal
    if (t.type === 'NUMBER') {
      advance();
      return { kind: 'number', value: parseFloat(t.value) };
    }

    // String literal
    if (t.type === 'STRING') {
      advance();
      return { kind: 'string', value: t.value };
    }

    // Boolean literal
    if (t.type === 'BOOLEAN') {
      advance();
      return { kind: 'boolean', value: t.value.toUpperCase() === 'TRUE' };
    }

    // Cell reference or range
    if (t.type === 'CELL_REF') {
      if (namedRanges?.has(t.value.toUpperCase())) return namedRangeRef(t);
      return cellRefOrRange(t);
    }

    // Function call
    if (t.type === 'FUNCTION') {
      return functionCall(t);
    }

    // Named range identifier
    if (t.type === 'IDENTIFIER') {
      const name = t.value.toUpperCase();
      if (letScopes.some(scope => scope.has(name))) {
        advance();
        return { kind: 'name', name };
      }
      return namedRangeRef(t);
    }

    // Sheet-qualified cell reference
    if (t.type === 'SHEET_REF') {
      return sheetRef(t);
    }

    // Parenthesized expression
    if (t.type === 'LPAREN') {
      advance();
      const node = expression();
      if (!expect('RPAREN')) {
        return errorNode('Expected closing parenthesis');
      }
      return node;
    }

    // Unexpected token
    advance();
    return errorNode(`Unexpected token: ${t.value}`);
  }

  function cellRefOrRange(refToken: Token): ASTNode {
    advance(); // consume the CELL_REF token
    const address = parseCellRef(refToken.value);

    if (!address) {
      return errorNode(`Invalid cell reference: ${refToken.value}`);
    }

    // Check if followed by COLON for a range
    if (peek()?.type === 'COLON') {
      advance(); // consume ':'
      const endToken = expect('CELL_REF');

      if (!endToken) {
        return errorNode('Expected cell reference after ":"');
      }

      const endAddress = parseCellRef(endToken.value);
      if (!endAddress) {
        return errorNode(`Invalid cell reference: ${endToken.value}`);
      }

      return {
        kind: 'range',
        start: address,
        end: endAddress,
        raw: `${refToken.value}:${endToken.value}`,
      };
    }

    return {
      kind: 'cellRef',
      address,
      raw: refToken.value,
    };
  }

  function functionCall(nameToken: Token): ASTNode {
    advance(); // consume FUNCTION token
    const name = nameToken.value.toUpperCase(); // normalize at parse time (avoids per-eval allocation)

    if (!expect('LPAREN')) {
      return errorNode(`Expected "(" after function name "${name}"`);
    }

    const argument = (): ASTNode => peek()?.type === 'COMMA' || peek()?.type === 'RPAREN'
      ? { kind: 'value', value: undefined } : expression();
    const args: ASTNode[] = [];
    if (name === 'LET') return letCall(args);

    // Parse comma-separated arguments (if any)
    const first = peek();
    if (first && first.type !== 'RPAREN' && first.type !== 'EOF') {
      args.push(argument());

      while (peek()?.type === 'COMMA') {
        advance(); // consume ','
        args.push(argument());
      }
    }

    if (!expect('RPAREN')) {
      return errorNode(`Expected ")" after function arguments for "${name}"`);
    }

    return { kind: 'functionCall', name, args };
  }

  /**
   * LET(name1, value1, [name2, value2, ...], calculation). An identifier
   * followed by a comma in a name position declares a name; it is in scope
   * for later values and the calculation, not for its own value.
   */
  function letCall(args: ASTNode[]): ASTNode {
    const scope = new Set<string>();
    letScopes.push(scope);
    try {
      for (;;) {
        const t = peek();
        if (t?.type === 'IDENTIFIER' && tokens[pos + 1]?.type === 'COMMA') {
          const name = t.value.toUpperCase();
          advance(); // name
          advance(); // ','
          args.push({ kind: 'name', name }, expression());
          scope.add(name);
          if (peek()?.type === 'COMMA') { advance(); continue; }
          break;
        }
        args.push(expression());
        break;
      }
    } finally { letScopes.pop(); }
    if (!expect('RPAREN')) return errorNode('Expected ")" after LET arguments');
    return { kind: 'functionCall', name: 'LET', args };
  }

  function namedRangeRef(nameToken: Token): ASTNode {
    advance(); // consume IDENTIFIER
    const name = nameToken.value.toUpperCase();
    const ref = namedRanges?.get(name);
    if (!ref) {
      return { kind: 'error', error: new FormulaError('#NAME?', `Unknown name: ${nameToken.value}`) };
    }

    if (ref.length > 32767) return { kind: 'error', error: new FormulaError('#VALUE!', 'Named range reference too long') };

    // Use the ordinary reference parser so workbook names retain sheet qualifiers.
    try {
      const node = parse(tokenize(ref));
      if (node.kind === 'range' || node.kind === 'cellRef') return node;
    } catch { /* Invalid workbook references become #REF!, as below. */ }

    return { kind: 'error', error: new FormulaError('#REF!', `Invalid named range reference: ${ref}`) };
  }

  function sheetRef(sheetToken: Token): ASTNode {
    advance(); // consume SHEET_REF
    const sheetName = sheetToken.value;

    // Expect a CELL_REF next
    const cellToken = expect('CELL_REF');
    if (!cellToken) {
      return errorNode(`Expected cell reference after sheet "${sheetName}!"`);
    }

    const address = parseCellRef(cellToken.value);
    if (!address) {
      return errorNode(`Invalid cell reference: ${cellToken.value}`);
    }

    // Set sheet on the address
    address.sheet = sheetName;

    // Check if followed by COLON for a range
    if (peek()?.type === 'COLON') {
      advance(); // consume ':'
      const endToken = expect('CELL_REF');
      if (!endToken) {
        return errorNode('Expected cell reference after ":"');
      }
      const endAddress = parseCellRef(endToken.value);
      if (!endAddress) {
        return errorNode(`Invalid cell reference: ${endToken.value}`);
      }
      endAddress.sheet = sheetName;
      return {
        kind: 'range',
        start: address,
        end: endAddress,
        raw: `${sheetName}!${cellToken.value}:${endToken.value}`,
      };
    }

    return {
      kind: 'cellRef',
      address,
      raw: `${sheetName}!${cellToken.value}`,
    };
  }

  // --- Entry point ---

  let result: ASTNode;
  try { result = expression(); } catch (error) {
    return { kind: 'error', error: error instanceof FormulaError ? error : new FormulaError('#ERROR!', 'Invalid formula') };
  }

  // Ensure all tokens were consumed (except EOF)
  const trailing = peek();
  if (trailing && trailing.type !== 'EOF') {
    return errorNode(`Unexpected token after expression: ${trailing.value}`);
  }

  const stack: Array<{ node: ASTNode; depth: number }> = [{ node: result, depth: 1 }];
  while (stack.length) {
    const entry = stack.pop();
    if (!entry) break;
    if (entry.depth > MAX_FORMULA_DEPTH) return errorNode('Formula too deep');
    const { node, depth } = entry;
    if (node.kind === 'binaryOp') stack.push({ node: node.left, depth: depth + 1 }, { node: node.right, depth: depth + 1 });
    else if (node.kind === 'unaryOp') stack.push({ node: node.operand, depth: depth + 1 });
    else if (node.kind === 'functionCall') for (const arg of node.args) stack.push({ node: arg, depth: depth + 1 });
  }
  return result;
}
