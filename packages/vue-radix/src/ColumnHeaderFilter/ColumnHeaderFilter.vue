<script setup lang="ts">
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import { useColumnHeaderFilterState, type UserLike, type ColumnFilterType, type IDateFilterValue } from '@alaarab/ogrid-vue';
import TextFilterPopover from './TextFilterPopover.vue';
import MultiSelectFilterPopover from './MultiSelectFilterPopover.vue';
import PeopleFilterPopover from './PeopleFilterPopover.vue';

export interface IColumnHeaderFilterProps {
  columnKey: string;
  columnName: string;
  filterType: ColumnFilterType;
  isSorted?: boolean;
  isSortedDescending?: boolean;
  onSort?: () => void;
  selectedValues?: string[];
  onFilterChange?: (values: string[]) => void;
  options?: string[];
  isLoadingOptions?: boolean;
  textValue?: string;
  onTextChange?: (value: string) => void;
  selectedUser?: UserLike;
  onUserChange?: (user: UserLike | undefined) => void;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
  dateValue?: IDateFilterValue;
  onDateChange?: (value: IDateFilterValue | undefined) => void;
}

const props = withDefaults(defineProps<IColumnHeaderFilterProps>(), {
  isSorted: false,
  isSortedDescending: false,
  options: () => [],
  isLoadingOptions: false,
  textValue: '',
});

const state = useColumnHeaderFilterState({
  filterType: () => props.filterType,
  isSorted: () => props.isSorted,
  isSortedDescending: () => props.isSortedDescending,
  onSort: props.onSort,
  selectedValues: () => props.selectedValues,
  onFilterChange: props.onFilterChange,
  options: () => props.options,
  isLoadingOptions: () => props.isLoadingOptions,
  textValue: () => props.textValue,
  onTextChange: props.onTextChange,
  selectedUser: () => props.selectedUser,
  onUserChange: props.onUserChange,
  peopleSearch: props.peopleSearch,
  dateValue: () => props.dateValue,
  onDateChange: props.onDateChange,
});

const getSortIcon = () => {
  if (props.isSorted) {
    return props.isSortedDescending ? '\u2193' : '\u2191';
  }
  return '\u21C5';
};
</script>

<template>
  <div class="column-header" ref="state.headerRef">
    <div class="header-content">
      <span class="column-name" :title="columnName" data-header-label>
        {{ columnName }}
      </span>
    </div>
    <div class="header-actions">
      <button
        v-if="onSort"
        type="button"
        :class="['sort-icon', { 'sort-active': isSorted }]"
        @click="state.handlers.handleSortClick"
        :aria-label="`Sort by ${columnName}`"
        :title="isSorted ? (isSortedDescending ? 'Sorted descending' : 'Sorted ascending') : 'Sort'"
      >
        <span aria-hidden>{{ getSortIcon() }}</span>
      </button>

      <Popover v-if="filterType !== 'none'" v-slot="{ open }">
        <PopoverButton
          :class="[
            'filter-icon',
            { 'filter-active': state.hasActiveFilter },
            { 'filter-open': open },
          ]"
          @click="state.handlers.handleFilterIconClick"
          :aria-label="`Filter ${columnName}`"
          :title="`Filter ${columnName}`"
        >
          <span aria-hidden>▼</span>
          <span v-if="state.hasActiveFilter" class="filter-badge" />
        </PopoverButton>

        <transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-1"
        >
          <PopoverPanel :ref="state.popoverRef" class="popover-content">
            <div class="popover-header">Filter: {{ columnName }}</div>

            <!-- Text Filter -->
            <TextFilterPopover
              v-if="filterType === 'text'"
              :value="state.tempTextValue"
              :onValueChange="state.setTempTextValue"
              :onApply="state.handlers.handleTextApply"
              :onClear="state.handlers.handleTextClear"
            />

            <!-- MultiSelect Filter -->
            <MultiSelectFilterPopover
              v-else-if="filterType === 'multiSelect'"
              :searchText="state.searchText"
              :onSearchChange="state.setSearchText"
              :options="options"
              :filteredOptions="state.filteredOptions"
              :selected="state.tempSelected"
              :onOptionToggle="state.handlers.handleCheckboxChange"
              :onSelectAll="state.handlers.handleSelectAll"
              :onClearSelection="state.handlers.handleClearSelection"
              :onApply="state.handlers.handleApplyMultiSelect"
              :isLoading="isLoadingOptions"
            />

            <!-- People Filter -->
            <PeopleFilterPopover
              v-else-if="filterType === 'people'"
              :selectedUser="selectedUser"
              :searchText="state.peopleSearchText"
              :onSearchChange="state.setPeopleSearchText"
              :suggestions="state.peopleSuggestions"
              :isLoading="state.isPeopleLoading"
              :onUserSelect="state.handlers.handleUserSelect"
              :onClearUser="state.handlers.handleClearUser"
              :inputRef="state.peopleInputRef"
            />

            <!-- Date Filter -->
            <div v-else-if="filterType === 'date'">
              <div style="padding: 8px 12px; display: flex; flex-direction: column; gap: 6px">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px">
                  From:
                  <input
                    type="date"
                    :value="state.tempDateFrom"
                    @input="state.setTempDateFrom(($event.target as HTMLInputElement).value)"
                    style="flex: 1"
                  />
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px">
                  To:
                  <input
                    type="date"
                    :value="state.tempDateTo"
                    @input="state.setTempDateTo(($event.target as HTMLInputElement).value)"
                    style="flex: 1"
                  />
                </label>
              </div>
              <div class="popover-actions">
                <button
                  class="clear-button"
                  @click="state.handlers.handleDateClear"
                  :disabled="!state.tempDateFrom && !state.tempDateTo"
                >
                  Clear
                </button>
                <button class="apply-button" @click="state.handlers.handleDateApply">
                  Apply
                </button>
              </div>
            </div>
          </PopoverPanel>
        </transition>
      </Popover>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import './ColumnHeaderFilter.module.scss';
</style>
