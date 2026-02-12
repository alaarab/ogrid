import { ref } from 'vue';
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
export declare function useDateFilterState(params: UseDateFilterStateParams): UseDateFilterStateResult;
