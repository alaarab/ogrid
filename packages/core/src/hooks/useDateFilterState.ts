/**
 * Date filter state sub-hook for column header filters.
 * Manages temporary date from/to values and apply/clear handlers.
 */

import { useState, useCallback, useEffect } from 'react';
import type { IDateFilterValue } from '../types/columnTypes';

export interface UseDateFilterStateParams {
  dateValue?: IDateFilterValue;
  onDateChange?: (value: IDateFilterValue | undefined) => void;
  isFilterOpen: boolean;
}

export interface UseDateFilterStateResult {
  tempDateFrom: string;
  setTempDateFrom: (v: string) => void;
  tempDateTo: string;
  setTempDateTo: (v: string) => void;
  handleDateApply: () => void;
  handleDateClear: () => void;
}

export function useDateFilterState(
  params: UseDateFilterStateParams
): UseDateFilterStateResult {
  const { dateValue, onDateChange, isFilterOpen } = params;

  const [tempDateFrom, setTempDateFrom] = useState(dateValue?.from ?? '');
  const [tempDateTo, setTempDateTo] = useState(dateValue?.to ?? '');

  // Sync temp state when popover opens
  useEffect(() => {
    if (isFilterOpen) {
      setTempDateFrom(dateValue?.from ?? '');
      setTempDateTo(dateValue?.to ?? '');
    }
  }, [isFilterOpen, dateValue]);

  const handleDateApply = useCallback(() => {
    const from = tempDateFrom || undefined;
    const to = tempDateTo || undefined;
    onDateChange?.(from || to ? { from, to } : undefined);
  }, [onDateChange, tempDateFrom, tempDateTo]);

  const handleDateClear = useCallback(() => {
    setTempDateFrom('');
    setTempDateTo('');
  }, []);

  return {
    tempDateFrom,
    setTempDateFrom,
    tempDateTo,
    setTempDateTo,
    handleDateApply,
    handleDateClear,
  };
}
