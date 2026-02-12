import { ref, watch } from 'vue';
import type { IDateFilterValue } from '../types';

export interface UseDateFilterStateParams {
  dateValue?: IDateFilterValue;
  onDateChange?: (value: IDateFilterValue | undefined) => void;
  isFilterOpen: () => boolean;
}

export interface UseDateFilterStateResult {
  tempDateFrom: ReturnType<typeof ref<string>>;
  setTempDateFrom: (v: string) => void;
  tempDateTo: ReturnType<typeof ref<string>>;
  setTempDateTo: (v: string) => void;
  handleDateApply: () => void;
  handleDateClear: () => void;
}

export function useDateFilterState(
  params: UseDateFilterStateParams
): UseDateFilterStateResult {
  const { onDateChange } = params;

  const tempDateFrom = ref(params.dateValue?.from ?? '');
  const tempDateTo = ref(params.dateValue?.to ?? '');

  // Sync temp state when popover opens
  watch(() => params.isFilterOpen(), (open) => {
    if (open) {
      tempDateFrom.value = params.dateValue?.from ?? '';
      tempDateTo.value = params.dateValue?.to ?? '';
    }
  });

  const setTempDateFrom = (v: string) => {
    tempDateFrom.value = v;
  };

  const setTempDateTo = (v: string) => {
    tempDateTo.value = v;
  };

  const handleDateApply = () => {
    const from = tempDateFrom.value || undefined;
    const to = tempDateTo.value || undefined;
    onDateChange?.(from || to ? { from, to } : undefined);
  };

  const handleDateClear = () => {
    tempDateFrom.value = '';
    tempDateTo.value = '';
  };

  return {
    tempDateFrom,
    setTempDateFrom,
    tempDateTo,
    setTempDateTo,
    handleDateApply,
    handleDateClear,
  };
}
