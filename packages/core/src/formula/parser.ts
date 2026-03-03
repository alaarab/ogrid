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

import type { Token, ASTNode, BinaryOp } from './types';
import { FormulaError } from './types';
import { parseCellRef, parseRange } from './cellAddressUtils';

/**
 * Parse an array of tokens into an AST.
 * Never throws  -  returns an ErrorNode on parse errors.
 *
 * @param tokens - The token array from the tokenizer.
 * @param namedRanges - Optional map of named ranges (name  to  ref string like "A1:B10").
 */
export function parse(tokens: Token[], namedRanges?: Map<string, string>): ASTNode {
  let pos = 0;

  // --- Token helpers ---

  function peek(): Token {
    return tokens[pos];
  }

  function advance(): Token {
    const token = tokens[pos];
    pos++;
    return token;
  }

  function expect(type: Token['type']): Token | null {
    const token = peek();
    if (token && token.type === type) {
      return advance();
    }
    return null;
  }

  function errorNode(message: string): ASTNode {
    return { kind: 'error', error: new FormulaError('#ERROR!', message) };
  }

  // --- Grammar rules ---

  function expression(): ASTNode {
    return comparison();
  }

  function comparison(): ASTNode {
    let left = concat();

    while (peek()) {
      const t = peek();
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

    while (peek() && peek().type === 'AMPERSAND') {
      advance();
      const right = addition();
      left = { kind: 'binaryOp', op: '&', left, right };
    }

    return left;
  }

  function addition(): ASTNode {
    let left = multiplication();

    while (peek()) {
      const t = peek();
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

    while (peek()) {
      const t = peek();
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

    while (peek() && peek().type === 'POWER') {
      advance();
      const right = unary();
      left = { kind: 'binaryOp', op: '^', left, right };
    }

    return left;
  }

  function unary(): ASTNode {
    const t = peek();

    if (t && (t.type === 'MINUS' || t.type === 'PLUS')) {
      const op = t.type === 'MINUS' ? '-' : '+';
      advance();
      const operand = unary();
      return { kind: 'unaryOp', op, operand };
    }

    return postfix();
  }

  function postfix(): ASTNode {
    let node = primary();

    if (peek() && peek().type === 'PERCENT') {
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
      return cellRefOrRange();
    }

    // Function call
    if (t.type === 'FUNCTION') {
      return functionCall();
    }

    // Named range identifier
    if (t.type === 'IDENTIFIER') {
      return namedRangeRef();
    }

    // Sheet-qualified cell reference
    if (t.type === 'SHEET_REF') {
      return sheetRef();
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

  function cellRefOrRange(): ASTNode {
    const refToken = advance(); // consume the CELL_REF token
    const address = parseCellRef(refToken.value);

    if (!address) {
      return errorNode(`Invalid cell reference: ${refToken.value}`);
    }

    // Check if followed by COLON for a range
    if (peek() && peek().type === 'COLON') {
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

  function functionCall(): ASTNode {
    const nameToken = advance(); // consume FUNCTION token
    const name = nameToken.value.toUpperCase(); // normalize at parse time (avoids per-eval allocation)

    if (!expect('LPAREN')) {
      return errorNode(`Expected "(" after function name "${name}"`);
    }

    const args: ASTNode[] = [];

    // Parse comma-separated arguments (if any)
    if (peek() && peek().type !== 'RPAREN' && peek().type !== 'EOF') {
      args.push(expression());

      while (peek() && peek().type === 'COMMA') {
        advance(); // consume ','
        args.push(expression());
      }
    }

    if (!expect('RPAREN')) {
      return errorNode(`Expected ")" after function arguments for "${name}"`);
    }

    return { kind: 'functionCall', name, args };
  }

  function namedRangeRef(): ASTNode {
    const nameToken = advance(); // consume IDENTIFIER
    const name = nameToken.value.toUpperCase();
    const ref = namedRanges?.get(name);
    if (!ref) {
      return { kind: 'error', error: new FormulaError('#NAME?', `Unknown name: ${nameToken.value}`) };
    }

    // Try to parse as range (A1:B10) first, then as single cell ref
    if (ref.includes(':')) {
      const rangeRef = parseRange(ref);
      if (rangeRef) {
        return { kind: 'range', start: rangeRef.start, end: rangeRef.end, raw: ref };
      }
    }
    const cellRef = parseCellRef(ref);
    if (cellRef) {
      return { kind: 'cellRef', address: cellRef, raw: ref };
    }

    return { kind: 'error', error: new FormulaError('#REF!', `Invalid named range reference: ${ref}`) };
  }

  function sheetRef(): ASTNode {
    const sheetToken = advance(); // consume SHEET_REF
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
    if (peek() && peek().type === 'COLON') {
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

  const result = expression();

  // Ensure all tokens were consumed (except EOF)
  if (peek() && peek().type !== 'EOF') {
    return errorNode(`Unexpected token after expression: ${peek().value}`);
  }

  return result;
}
