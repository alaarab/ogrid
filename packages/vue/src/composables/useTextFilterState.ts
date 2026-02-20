import { ref, watch, type Ref } from 'vue';

export interface UseTextFilterStateParams {
  textValue?: string;
  onTextChange?: (value: string) => void;
  isFilterOpen: Ref<boolean>;
}

export interface UseTextFilterStateResult {
  tempTextValue: ReturnType<typeof ref<string>>;
  setTempTextValue: (v: string) => void;
  handleTextApply: () => void;
  handleTextClear: () => void;
}

export function useTextFilterState(
  params: UseTextFilterStateParams
): UseTextFilterStateResult {
  const { textValue = '', onTextChange } = params;

  const tempTextValue = ref(textValue);

  // Sync temp state when popover opens
  watch(params.isFilterOpen, (open) => {
    if (open) {
      tempTextValue.value = params.textValue ?? '';
    }
  });

  const setTempTextValue = (v: string) => {
    tempTextValue.value = v;
  };

  const handleTextApply = () => {
    onTextChange?.(tempTextValue.value.trim());
  };

  const handleTextClear = () => {
    tempTextValue.value = '';
  };

  return {
    tempTextValue,
    setTempTextValue,
    handleTextApply,
    handleTextClear,
  };
}
