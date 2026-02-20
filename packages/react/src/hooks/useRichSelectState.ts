import { useState, useCallback, useMemo } from 'react';

/** Shared display text formatter for select and rich-select editors. */
export function getSelectDisplayText(value: unknown, formatValue?: (v: unknown) => string): string {
  if (formatValue) return formatValue(value);
  return value != null ? String(value) : '';
}

export interface UseRichSelectStateParams {
  values: unknown[];
  formatValue?: (value: unknown) => string;
  initialValue: unknown;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}

export interface UseRichSelectStateResult {
  searchText: string;
  setSearchText: (text: string) => void;
  filteredValues: unknown[];
  highlightedIndex: number;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  selectValue: (value: unknown) => void;
  getDisplayText: (value: unknown) => string;
}

/**
 * Manages searchable rich select editor state with keyboard navigation (arrow keys, enter, escape).
 * @param params - Values, format function, initial value, and commit/cancel callbacks.
 * @returns Search text, filtered values, highlighted index, keyboard handler, and select function.
 */
export function useRichSelectState(params: UseRichSelectStateParams): UseRichSelectStateResult {
  const { values, formatValue, onCommit, onCancel } = params;
  const [searchText, setSearchText] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const getDisplayText = useCallback(
    (value: unknown): string => getSelectDisplayText(value, formatValue),
    [formatValue]
  );

  const filteredValues = useMemo(() => {
    if (!searchText.trim()) return values;
    const lower = searchText.toLowerCase();
    return values.filter((v) => getDisplayText(v).toLowerCase().includes(lower));
  }, [values, searchText, getDisplayText]);

  const selectValue = useCallback(
    (value: unknown) => {
      onCommit(value);
    },
    [onCommit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, filteredValues.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (filteredValues.length > 0 && highlightedIndex < filteredValues.length) {
            selectValue(filteredValues[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onCancel();
          break;
      }
    },
    [filteredValues, highlightedIndex, selectValue, onCancel]
  );

  return {
    searchText,
    setSearchText,
    filteredValues,
    highlightedIndex,
    handleKeyDown,
    selectValue,
    getDisplayText,
  };
}
