/**
 * Caret-aware helpers for formula editing help: which identifier is being
 * typed (for autocomplete), which function call and argument the caret is in
 * (for argument hints), completion matching, and applying a completion.
 *
 * All positions are string indexes into the full editor text, including the
 * leading '='. Text that does not start with '=' has no formula context.
 */

import type { IFormulaFunctionMetadata } from './functionMetadata';

/** The identifier at the caret that autocomplete would replace. */
export interface IFormulaCaretToken {
  /** Text from the token start up to the caret: what completions match against. */
  prefix: string;
  /** Start of the identifier. */
  start: number;
  /** End of the identifier (it can run past the caret). */
  end: number;
}

/** The innermost function call enclosing the caret. */
export interface IFormulaCaretCall {
  /** Upper-case function name. */
  name: string;
  /** 0-based index of the argument the caret is in. */
  argIndex: number;
  /** Index of the call's '('. */
  openParen: number;
}

export interface IFormulaCaretContext {
  token: IFormulaCaretToken | null;
  call: IFormulaCaretCall | null;
  /** True when the caret sits inside a "string literal". */
  inString: boolean;
}

const EMPTY_CONTEXT: IFormulaCaretContext = { token: null, call: null, inString: false };

function isNameStart(c: string | undefined): boolean {
  return c !== undefined && /[A-Za-z_]/.test(c);
}

function isNameChar(c: string | undefined): boolean {
  return c !== undefined && /[A-Za-z0-9_.]/.test(c);
}

/** Characters after which a function name or named range can start. */
const TOKEN_BOUNDARY = /[=+\-*/^&%<>,(:{\s]/;

interface Frame {
  kind: 'call' | 'group' | 'array';
  name: string;
  argIndex: number;
  openParen: number;
}

/**
 * Work out what the caret is in: the identifier being typed (if it is in a
 * position where a function or name can go) and the enclosing function call
 * with the current argument index. Strings, quoted sheet names, nested calls
 * and array constants are tracked so their commas don't count.
 */
export function getFormulaCaretContext(text: string, caret: number): IFormulaCaretContext {
  if (!text.startsWith('=')) return EMPTY_CONTEXT;
  const end = Math.max(1, Math.min(caret, text.length));
  const stack: Frame[] = [];
  let inString = false;
  let inQuote = false;

  for (let i = 1; i < end; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '"') {
        if (text[i + 1] === '"' && i + 1 < end) i++;
        else inString = false;
      }
      continue;
    }
    if (inQuote) {
      if (ch === "'") {
        if (text[i + 1] === "'" && i + 1 < end) i++;
        else inQuote = false;
      }
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "'") inQuote = true;
    else if (ch === '(') {
      let s = i;
      while (s > 1 && isNameChar(text[s - 1])) s--;
      const word = text.slice(s, i);
      const isCall = word.length > 0 && isNameStart(word[0]) && text[s - 1] !== '!' && text[s - 1] !== '$';
      stack.push({ kind: isCall ? 'call' : 'group', name: isCall ? word.toUpperCase() : '', argIndex: 0, openParen: i });
    } else if (ch === '{') {
      stack.push({ kind: 'array', name: '', argIndex: 0, openParen: i });
    } else if (ch === ')') {
      const top = stack[stack.length - 1];
      if (top && top.kind !== 'array') stack.pop();
    } else if (ch === '}') {
      const top = stack[stack.length - 1];
      if (top && top.kind === 'array') stack.pop();
    } else if (ch === ',') {
      const top = stack[stack.length - 1];
      if (top && top.kind === 'call') top.argIndex++;
    }
  }

  let call: IFormulaCaretCall | null = null;
  for (let k = stack.length - 1; k >= 0; k--) {
    const frame = stack[k] as Frame;
    if (frame.kind === 'call') {
      call = { name: frame.name, argIndex: frame.argIndex, openParen: frame.openParen };
      break;
    }
  }

  let token: IFormulaCaretToken | null = null;
  if (!inString && !inQuote) {
    let start = end;
    while (start > 1 && isNameChar(text[start - 1])) start--;
    const before = text[start - 1];
    if (start < end && isNameStart(text[start]) && before !== undefined && TOKEN_BOUNDARY.test(before)) {
      let tokenEnd = end;
      while (isNameChar(text[tokenEnd])) tokenEnd++;
      token = { prefix: text.slice(start, end), start, end: tokenEnd };
    }
  }

  return { token, call, inString };
}

/** One autocomplete entry. */
export interface IFormulaCompletion {
  kind: 'function' | 'name';
  /** Upper-case function name, or the named range as defined. */
  name: string;
  /** Function description, or the range a name refers to. */
  description: string;
  /** Function signature, e.g. "SUM(number1, [number2], ...)". Functions only. */
  signature?: string;
}

const CELL_REF_LIKE = /^\$?[A-Za-z]{1,3}\$?\d+$/;

/**
 * Functions and named ranges matching `prefix` (case-insensitive): names that
 * start with it first, then names that contain it, each group alphabetical.
 * A prefix shaped like a cell reference ("B2") only gets start-with matches.
 */
export function getFormulaCompletions(
  prefix: string,
  functions: IFormulaFunctionMetadata[],
  namedRanges?: Record<string, string>,
  limit = 50,
): IFormulaCompletion[] {
  const needle = prefix.toUpperCase();
  if (!needle) return [];
  const all: IFormulaCompletion[] = functions.map((f) => ({
    kind: 'function' as const,
    name: f.name,
    description: f.description,
    signature: f.signature,
  }));
  if (namedRanges) {
    for (const name of Object.keys(namedRanges)) {
      all.push({ kind: 'name', name, description: namedRanges[name] ?? '' });
    }
  }
  const byName = (a: IFormulaCompletion, b: IFormulaCompletion) => {
    const x = a.name.toUpperCase();
    const y = b.name.toUpperCase();
    return x < y ? -1 : x > y ? 1 : 0;
  };
  const starts = all.filter((c) => c.name.toUpperCase().startsWith(needle)).sort(byName);
  const contains = CELL_REF_LIKE.test(prefix)
    ? []
    : all.filter((c) => {
        const upper = c.name.toUpperCase();
        return !upper.startsWith(needle) && upper.includes(needle);
      }).sort(byName);
  return [...starts, ...contains].slice(0, limit);
}

/**
 * Replace the token at the caret with a completion. Functions insert
 * `NAME(` (reusing a '(' already after the token); names insert as typed.
 * Returns the new text and caret position.
 */
export function applyFormulaCompletion(
  text: string,
  token: Pick<IFormulaCaretToken, 'start' | 'end'>,
  completion: Pick<IFormulaCompletion, 'kind' | 'name'>,
): { text: string; caret: number } {
  const before = text.slice(0, token.start);
  const after = text.slice(token.end);
  if (completion.kind === 'function') {
    if (after.startsWith('(')) {
      return { text: before + completion.name + after, caret: token.start + completion.name.length + 1 };
    }
    const inserted = `${completion.name}(`;
    return { text: before + inserted + after, caret: token.start + inserted.length };
  }
  return { text: before + completion.name + after, caret: token.start + completion.name.length };
}
