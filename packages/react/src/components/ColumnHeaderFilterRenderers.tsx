/**
 * Shared filter content dispatching for ColumnHeaderFilter across all React UI packages.
 *
 * Each UI package provides framework-specific sub-filter components (TextFilterPopover,
 * MultiSelectFilterPopover, PeopleFilterPopover, date content). This utility dispatches
 * to the correct renderer based on filterType, eliminating the duplicated if/switch chain
 * that was previously in each UI package's ColumnHeaderFilter component.
 */

import type * as React from 'react';
import type { ColumnFilterType } from '../types/columnTypes';
import type { UserLike } from '../types/dataGridTypes';
import type { UseColumnHeaderFilterStateResult } from '../hooks/useColumnHeaderFilterState';

/**
 * Framework-specific renderers for each filter type.
 * Each UI package maps its own sub-filter components to these slots.
 */
export interface FilterContentRenderers {
  renderMultiSelect: (props: MultiSelectRendererProps) => React.ReactNode;
  renderText: (props: TextRendererProps) => React.ReactNode;
  renderPeople: (props: PeopleRendererProps) => React.ReactNode;
  renderDate: (props: DateRendererProps) => React.ReactNode;
}

export interface MultiSelectRendererProps {
  searchText: string;
  onSearchChange: (value: string) => void;
  options: string[];
  filteredOptions: string[];
  selected: Set<string>;
  onOptionToggle: (option: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onApply: () => void;
  isLoading: boolean;
}

export interface TextRendererProps {
  value: string;
  onValueChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
}

export interface PeopleRendererProps {
  selectedUser: UserLike | undefined;
  searchText: string;
  onSearchChange: (value: string) => void;
  suggestions: UserLike[];
  isLoading: boolean;
  onUserSelect: (user: UserLike) => void;
  onClearUser: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export interface DateRendererProps {
  tempDateFrom: string;
  setTempDateFrom: (v: string) => void;
  tempDateTo: string;
  setTempDateTo: (v: string) => void;
  onApply: () => void;
  onClear: () => void;
}

/**
 * Dispatches to the appropriate filter content renderer based on filterType.
 * Eliminates the duplicated if/switch chain in each UI package's ColumnHeaderFilter.
 *
 * @param filterType - The column's filter type
 * @param state - The result from useColumnHeaderFilterState
 * @param options - The filter options array (for multiSelect)
 * @param isLoadingOptions - Whether options are loading
 * @param selectedUser - The currently selected user (for people filter)
 * @param renderers - Framework-specific renderer functions
 * @returns The rendered filter content, or null for unsupported filter types
 */
export function renderFilterContent(
  filterType: ColumnFilterType,
  state: UseColumnHeaderFilterStateResult,
  options: string[],
  isLoadingOptions: boolean,
  selectedUser: UserLike | undefined,
  renderers: FilterContentRenderers
): React.ReactNode {
  if (filterType === 'multiSelect') {
    return renderers.renderMultiSelect({
      searchText: state.searchText,
      onSearchChange: state.setSearchText,
      options,
      filteredOptions: state.filteredOptions,
      selected: state.tempSelected,
      onOptionToggle: state.handlers.handleCheckboxChange,
      onSelectAll: state.handlers.handleSelectAll,
      onClearSelection: state.handlers.handleClearSelection,
      onApply: state.handlers.handleApplyMultiSelect,
      isLoading: isLoadingOptions,
    });
  }
  if (filterType === 'text') {
    return renderers.renderText({
      value: state.tempTextValue,
      onValueChange: state.setTempTextValue,
      onApply: state.handlers.handleTextApply,
      onClear: state.handlers.handleTextClear,
    });
  }
  if (filterType === 'people') {
    return renderers.renderPeople({
      selectedUser,
      searchText: state.peopleSearchText,
      onSearchChange: state.setPeopleSearchText,
      suggestions: state.peopleSuggestions,
      isLoading: state.isPeopleLoading,
      onUserSelect: state.handlers.handleUserSelect,
      onClearUser: state.handlers.handleClearUser,
      inputRef: state.peopleInputRef,
    });
  }
  if (filterType === 'date') {
    return renderers.renderDate({
      tempDateFrom: state.tempDateFrom,
      setTempDateFrom: state.setTempDateFrom,
      tempDateTo: state.tempDateTo,
      setTempDateTo: state.setTempDateTo,
      onApply: state.handlers.handleDateApply,
      onClear: state.handlers.handleDateClear,
    });
  }
  return null;
}
