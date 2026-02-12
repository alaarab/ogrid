import { ref, computed, type Ref } from 'vue';

export interface UseRichSelectStateParams {
  values: unknown[];
  formatValue?: (value: unknown) => string;
  initialValue: unknown;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}

export interface UseRichSelectStateResult {
  searchText: Ref<string>;
  setSearchText: (text: string) => void;
  filteredValues: Ref<unknown[]>;
  highlightedIndex: Ref<number>;
  handleKeyDown: (e: KeyboardEvent) => void;
  selectValue: (value: unknown) => void;
  getDisplayText: (value: unknown) => string;
}

/**
 * Manages searchable rich select editor state with keyboard navigation.
 */
export function useRichSelectState(params: UseRichSelectStateParams): UseRichSelectStateResult {
  const { values, formatValue, onCommit, onCancel } = params;
  const searchText = ref('');
  const highlightedIndex = ref(0);

  const setSearchText = (text: string) => {
    searchText.value = text;
  };

  const getDisplayText = (value: unknown): string => {
    if (formatValue) return formatValue(value);
    return value != null ? String(value) : '';
  };

  const filteredValues = computed(() => {
    if (!searchText.value.trim()) return values;
    const lower = searchText.value.toLowerCase();
    return values.filter((v) => getDisplayText(v).toLowerCase().includes(lower));
  });

  const selectValue = (value: unknown) => {
    onCommit(value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredValues.value.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (filteredValues.value.length > 0 && highlightedIndex.value < filteredValues.value.length) {
          selectValue(filteredValues.value[highlightedIndex.value]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onCancel();
        break;
    }
  };

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
