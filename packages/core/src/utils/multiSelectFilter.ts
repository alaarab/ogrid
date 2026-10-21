import type { MultiSelectFilterMode } from '../types';

/**
 * The option values a cell holds: each item of an array value (an empty array
 * is the blank option), otherwise the value itself. null/undefined is blank ('').
 */
export function getMultiSelectCellValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.length === 0 ? [''] : value.map((item) => String(item ?? ''));
  }
  return [String(value ?? '')];
}

/**
 * Row predicate input for a multi-select filter. `any` (default) keeps cells
 * holding at least one selected option, `all` cells holding every selected
 * option, and `none` cells holding none of them (exclude, "not in").
 */
export function createMultiSelectMatcher(
  selected: readonly string[],
  mode: MultiSelectFilterMode = 'any',
): (value: unknown) => boolean {
  const set = new Set(selected);
  if (mode === 'all') {
    return (value) => {
      const held = new Set(getMultiSelectCellValues(value));
      for (const option of set) if (!held.has(option)) return false;
      return true;
    };
  }
  const anyHeld = (value: unknown) => {
    if (!Array.isArray(value)) return set.has(String(value ?? ''));
    return getMultiSelectCellValues(value).some((v) => set.has(v));
  };
  return mode === 'none' ? (value) => !anyHeld(value) : anyHeld;
}
