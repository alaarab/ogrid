import { useState, useCallback, useEffect, useRef } from 'react';
import { getSelectDisplayText } from './useRichSelectState';

export interface UseSelectStateParams {
  values: unknown[];
  formatValue?: (value: unknown) => string;
  initialValue: unknown;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}

export interface UseSelectStateResult {
  highlightedIndex: number;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  selectValue: (value: unknown) => void;
  getDisplayText: (value: unknown) => string;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Manages select editor state with keyboard navigation (arrow keys, enter, escape).
 * Simpler than useRichSelectState — no search, just a dropdown list.
 */
export function useSelectState(params: UseSelectStateParams): UseSelectStateResult {
  const { values, formatValue, initialValue, onCommit, onCancel } = params;
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const getDisplayText = useCallback(
    (value: unknown): string => getSelectDisplayText(value, formatValue),
    [formatValue]
  );

  // Start highlighted on current value
  const initialIndex = values.findIndex((v) => String(v) === String(initialValue));
  const [highlightedIndex, setHighlightedIndex] = useState(Math.max(initialIndex, 0));

  // Reset highlighted index when initialValue changes (e.g., opening editor on a different cell)
  useEffect(() => {
    const idx = values.findIndex((v) => String(v) === String(initialValue));
    setHighlightedIndex(Math.max(idx, 0));
  }, [initialValue, values]);

  // Scroll highlighted option into view
  useEffect(() => {
    const dropdown = dropdownRef.current;
    if (!dropdown) return;
    const highlighted = dropdown.children[highlightedIndex] as HTMLElement | undefined;
    highlighted?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

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
          setHighlightedIndex((prev) => Math.min(prev + 1, values.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (values.length > 0 && highlightedIndex < values.length) {
            selectValue(values[highlightedIndex]);
          }
          break;
        case 'Tab':
          e.preventDefault();
          if (values.length > 0 && highlightedIndex < values.length) {
            selectValue(values[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onCancel();
          break;
      }
    },
    [values, highlightedIndex, selectValue, onCancel]
  );

  return {
    highlightedIndex,
    handleKeyDown,
    selectValue,
    getDisplayText,
    dropdownRef,
  };
}
