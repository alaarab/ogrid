<script setup lang="ts">
import { useColumnHeaderFilterState } from '@alaarab/ogrid-vue';
import TextFilterPopover from './TextFilterPopover.vue';
import MultiSelectFilterPopover from './MultiSelectFilterPopover.vue';
import PeopleFilterPopover from './PeopleFilterPopover.vue';
import type { IColumnHeaderFilterProps } from './types';

const props = withDefaults(defineProps<IColumnHeaderFilterProps>(), {
  isSorted: false,
  isSortedDescending: false,
  options: () => [],
  isLoadingOptions: false,
  textValue: '',
});

const state = useColumnHeaderFilterState({
  filterType: props.filterType,
  isSorted: props.isSorted,
  isSortedDescending: props.isSortedDescending,
  onSort: props.onSort,
  selectedValues: props.selectedValues,
  onFilterChange: props.onFilterChange,
  options: props.options,
  isLoadingOptions: props.isLoadingOptions,
  textValue: props.textValue,
  onTextChange: props.onTextChange,
  selectedUser: props.selectedUser,
  onUserChange: props.onUserChange,
  peopleSearch: props.peopleSearch,
  dateValue: props.dateValue,
  onDateChange: props.onDateChange,
});

// Destructure refs to top-level so Vue auto-unwraps them in templates
const {
  headerRef, popoverRef, isFilterOpen, hasActiveFilter,
  tempSelected, tempTextValue, searchText, filteredOptions,
  peopleSearchText, peopleSuggestions, isPeopleLoading, peopleInputRef,
  tempDateFrom, tempDateTo,
  setTempTextValue, setSearchText, setPeopleSearchText,
  setTempDateFrom, setTempDateTo,
  popoverPosition,
  handlers,
} = state;

const setHeaderRefEl = (el: any) => { headerRef.value = el as HTMLDivElement; };
const setPopoverRefEl = (el: any) => { popoverRef.value = el as HTMLDivElement; };


</script>

<template>
  <div class="column-header" :ref="setHeaderRefEl">
    <div class="header-content">
      <span class="column-name" :title="columnName" data-header-label>
        {{ columnName }}
      </span>
    </div>
    <div class="header-actions">
      <button
        v-if="filterType !== 'none'"
        :class="[
          'filter-icon',
          { 'filter-active': hasActiveFilter },
          { 'filter-open': isFilterOpen },
        ]"
        @click="handlers.handleFilterIconClick"
        :aria-label="`Filter ${columnName}`"
        :aria-expanded="isFilterOpen"
        aria-haspopup="dialog"
        :title="`Filter ${columnName}`"
      >
        <span aria-hidden>▼</span>
        <span v-if="hasActiveFilter" class="filter-badge" />
      </button>
    </div>

    <Teleport to="body">
    <div
      v-if="isFilterOpen && filterType !== 'none'"
      :ref="setPopoverRefEl"
      class="popover-content"
      :style="popoverPosition ? { position: 'fixed', top: popoverPosition.top + 'px', left: popoverPosition.left + 'px' } : {}"
      @click.stop
    >
      <div class="popover-header">Filter: {{ columnName }}</div>

      <!-- Text Filter -->
      <TextFilterPopover
        v-if="filterType === 'text'"
        :value="tempTextValue ?? ''"
        :onValueChange="setTempTextValue"
        :onApply="handlers.handleTextApply"
        :onClear="handlers.handleTextClear"
      />

      <!-- MultiSelect Filter -->
      <MultiSelectFilterPopover
        v-else-if="filterType === 'multiSelect'"
        :searchText="searchText"
        :onSearchChange="setSearchText"
        :options="options"
        :filteredOptions="filteredOptions"
        :selected="tempSelected"
        :onOptionToggle="handlers.handleCheckboxChange"
        :onSelectAll="handlers.handleSelectAll"
        :onClearSelection="handlers.handleClearSelection"
        :onApply="handlers.handleApplyMultiSelect"
        :isLoading="isLoadingOptions"
      />

      <!-- People Filter -->
      <PeopleFilterPopover
        v-else-if="filterType === 'people'"
        :selectedUser="selectedUser"
        :searchText="peopleSearchText"
        :onSearchChange="setPeopleSearchText"
        :suggestions="peopleSuggestions"
        :isLoading="isPeopleLoading"
        :onUserSelect="handlers.handleUserSelect"
        :onClearUser="handlers.handleClearUser"
        :inputRef="peopleInputRef"
      />

      <!-- Date Filter -->
      <div v-else-if="filterType === 'date'">
        <div style="padding: 8px 12px; display: flex; flex-direction: column; gap: 6px">
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px">
            From:
            <input
              type="date"
              :value="tempDateFrom"
              @input="setTempDateFrom(($event.target as HTMLInputElement).value)"
              style="flex: 1"
            />
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px">
            To:
            <input
              type="date"
              :value="tempDateTo"
              @input="setTempDateTo(($event.target as HTMLInputElement).value)"
              style="flex: 1"
            />
          </label>
        </div>
        <div class="popover-actions">
          <button
            class="clear-button"
            @click="handlers.handleDateClear"
            :disabled="!tempDateFrom && !tempDateTo"
          >
            Clear
          </button>
          <button class="apply-button" @click="handlers.handleDateApply">
            Apply
          </button>
        </div>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@import './ColumnHeaderFilter.module.scss';
</style>
