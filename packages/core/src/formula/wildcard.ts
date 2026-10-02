import { FormulaError } from './types';
import { MAX_WILDCARD_STEPS } from './limits';

type Part = { kind: 'literal'; text: string } | { kind: 'star' | 'any' };

/** Bounded wildcard matching avoids exponential regular-expression backtracking. */
export function wildcard(pattern: string): (text: string, search?: boolean, consume?: (steps: number) => void) => number {
  if (!/[~*?]/.test(pattern)) {
    const lower = pattern.toLowerCase();
    return (text, search = false, consume) => {
      // Native comparison is linear in text already capped per cell; only the DP below is charged per step.
      consume?.(1);
      const candidate = text.toLowerCase();
      return search ? candidate.indexOf(lower) : candidate === lower ? 0 : -1;
    };
  }
  const parts: Part[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i] ?? '';
    if (char === '~' && i + 1 < pattern.length && '*?~'.includes(pattern[i + 1] ?? '')) {
      parts.push({ kind: 'literal', text: (pattern[++i] ?? '').toLowerCase() });
    } else if (char === '*') {
      if (parts[parts.length - 1]?.kind !== 'star') parts.push({ kind: 'star' });
    } else if (char === '?') parts.push({ kind: 'any' });
    else parts.push({ kind: 'literal', text: char.toLowerCase() });
  }
  return (text, search = false, consume) => {
    let steps = 0;
    let previous = new Array<number>(parts.length + 1).fill(-1);
    previous[0] = 0;
    for (let j = 1; j <= parts.length; j++) if (parts[j - 1]?.kind === 'star') previous[j] = previous[j - 1] ?? -1; else break;
    if (search && (previous[parts.length] ?? -1) >= 0) return 0;
    let best = -1;
    const lower = text.toLowerCase();
    let current = new Array<number>(parts.length + 1);
    for (let i = 0; i < lower.length; i++) {
      steps += parts.length;
      if (steps > MAX_WILDCARD_STEPS) throw new FormulaError('#VALUE!', 'Wildcard work limit exceeded');
      consume?.(parts.length);
      current.fill(-1);
      if (search) current[0] = i + 1;
      for (let j = 1; j <= parts.length; j++) {
        const part = parts[j - 1];
        if (part?.kind === 'star') {
          const a = current[j - 1] ?? -1;
          const b = previous[j] ?? -1;
          current[j] = a < 0 ? b : b < 0 ? a : Math.min(a, b);
        } else if (part?.kind === 'any' || part?.kind === 'literal' && part.text === lower[i]) current[j] = previous[j - 1] ?? -1;
      }
      const match = current[parts.length] ?? -1;
      if (search && match >= 0 && (best < 0 || match < best)) best = match;
      [previous, current] = [current, previous];
    }
    return search ? best : previous[parts.length] ?? -1;
  };
}
