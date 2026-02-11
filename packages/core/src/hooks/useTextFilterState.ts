/**
 * Text filter state sub-hook for column header filters.
 * Manages temporary text value and apply/clear handlers.
 */

import { useState, useCallback, useEffect } from 'react';

export interface UseTextFilterStateParams {
  textValue?: string;
  onTextChange?: (value: string) => void;
  isFilterOpen: boolean;
}

export interface UseTextFilterStateResult {
  tempTextValue: string;
  setTempTextValue: (v: string) => void;
  handleTextApply: () => void;
  handleTextClear: () => void;
}

export function useTextFilterState(
  params: UseTextFilterStateParams
): UseTextFilterStateResult {
  const { textValue = '', onTextChange, isFilterOpen } = params;

  const [tempTextValue, setTempTextValue] = useState(textValue);

  // Sync temp state when popover opens
  useEffect(() => {
    if (isFilterOpen) {
      setTempTextValue(textValue);
    }
  }, [isFilterOpen, textValue]);

  const handleTextApply = useCallback(() => {
    onTextChange?.(tempTextValue.trim());
  }, [onTextChange, tempTextValue]);

  const handleTextClear = useCallback(() => setTempTextValue(''), []);

  return {
    tempTextValue,
    setTempTextValue,
    handleTextApply,
    handleTextClear,
  };
}
