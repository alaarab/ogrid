import * as React from 'react';
import { Tooltip } from '@fluentui/react-components';
import { ArrowUpRegular, ArrowDownRegular, ArrowSortRegular, FilterRegular } from '@fluentui/react-icons';
import type { UserLike, ColumnFilterType } from '@alaarab/ogrid-core';
import { useColumnHeaderFilterState } from '@alaarab/ogrid-core';
import { TextFilterPopover } from './TextFilterPopover';
import { MultiSelectFilterPopover } from './MultiSelectFilterPopover';
import { PeopleFilterPopover } from './PeopleFilterPopover';
import styles from './ColumnHeaderFilter.module.scss';

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
}

export const ColumnHeaderFilter: React.FC<IColumnHeaderFilterProps> = React.memo((props) => {
  const {
    columnName,
    filterType,
    isSorted = false,
    isSortedDescending = false,
    onSort,
    selectedValues,
    onFilterChange,
    options,
    isLoadingOptions = false,
    textValue = '',
    onTextChange,
    selectedUser,
    onUserChange,
    peopleSearch,
  } = props;

  const state = useColumnHeaderFilterState({
    filterType,
    isSorted,
    isSortedDescending,
    onSort,
    selectedValues,
    onFilterChange,
    options,
    isLoadingOptions,
    textValue,
    onTextChange,
    selectedUser,
    onUserChange,
    peopleSearch,
  });

  const {
    headerRef,
    popoverRef,
    peopleInputRef,
    isFilterOpen,
    tempSelected,
    setTempTextValue,
    searchText,
    setSearchText,
    filteredOptions,
    peopleSuggestions,
    isPeopleLoading,
    peopleSearchText,
    setPeopleSearchText,
    hasActiveFilter,
    popoverPosition,
    handlers,
  } = state;

  const renderPopoverContent = (): React.ReactNode => {
    if (filterType === 'multiSelect') {
      return (
        <MultiSelectFilterPopover
          searchText={searchText}
          onSearchChange={setSearchText}
          options={options ?? []}
          filteredOptions={filteredOptions}
          selected={tempSelected}
          onOptionToggle={handlers.handleCheckboxChange}
          onSelectAll={handlers.handleSelectAll}
          onClearSelection={handlers.handleClearSelection}
          onApply={handlers.handleApplyMultiSelect}
          isLoading={isLoadingOptions}
          onPopoverClick={handlers.handlePopoverClick}
          onInputFocus={handlers.handleInputFocus}
          onInputMouseDown={handlers.handleInputMouseDown}
          onInputClick={handlers.handleInputClick}
          onInputKeyDown={handlers.handleInputKeyDown}
        />
      );
    }
    if (filterType === 'text') {
      return (
        <TextFilterPopover
          value={state.tempTextValue}
          onValueChange={setTempTextValue}
          onApply={handlers.handleTextApply}
          onClear={handlers.handleTextClear}
          onPopoverClick={handlers.handlePopoverClick}
          onInputFocus={handlers.handleInputFocus}
          onInputMouseDown={handlers.handleInputMouseDown}
          onInputClick={handlers.handleInputClick}
          onInputKeyDown={handlers.handleInputKeyDown}
        />
      );
    }
    if (filterType === 'people') {
      return (
        <PeopleFilterPopover
          selectedUser={selectedUser}
          searchText={peopleSearchText}
          onSearchChange={setPeopleSearchText}
          suggestions={peopleSuggestions}
          isLoading={isPeopleLoading}
          onUserSelect={handlers.handleUserSelect}
          onClearUser={handlers.handleClearUser}
          onPopoverClick={handlers.handlePopoverClick}
          inputRef={peopleInputRef as React.RefObject<HTMLInputElement>}
        />
      );
    }
    return null;
  };

  return (
    <div className={styles.columnHeader} ref={headerRef as React.RefObject<HTMLDivElement>}>
      <div className={styles.headerContent}>
        <Tooltip content={columnName} relationship="label" withArrow>
          <span className={styles.columnNameTooltipTrigger}>
            <span className={styles.columnName} data-header-label>
              {columnName}
            </span>
          </span>
        </Tooltip>
      </div>

      <div className={styles.headerActions}>
        {onSort && (
          <button
            type="button"
            className={`${styles.sortIcon} ${isSorted ? styles.sortActive : ''}`}
            onClick={handlers.handleSortClick}
            aria-label={`Sort by ${columnName}`}
            title={isSorted ? (isSortedDescending ? 'Sorted descending' : 'Sorted ascending') : 'Sort'}
          >
            {isSorted ? (
              isSortedDescending ? <ArrowDownRegular /> : <ArrowUpRegular />
            ) : (
              <ArrowSortRegular />
            )}
          </button>
        )}

        {filterType !== 'none' && (
          <button
            type="button"
            className={`${styles.filterIcon} ${hasActiveFilter ? styles.filterActive : ''} ${isFilterOpen ? styles.filterOpen : ''}`}
            onClick={handlers.handleFilterIconClick}
            aria-label={`Filter ${columnName}`}
            title={`Filter ${columnName}`}
          >
            <FilterRegular />
            {hasActiveFilter && <span className={styles.filterBadge} />}
          </button>
        )}
      </div>

      {isFilterOpen && filterType !== 'none' && (
        <div
          className={styles.filterPopover}
          ref={popoverRef as React.RefObject<HTMLDivElement>}
          onClick={handlers.handlePopoverClick}
          style={
            popoverPosition
              ? { top: `${popoverPosition.top}px`, left: `${popoverPosition.left}px` }
              : { top: 0, left: 0 }
          }
        >
          <div className={styles.popoverHeader}>Filter: {columnName}</div>
          {renderPopoverContent()}
        </div>
      )}
    </div>
  );
});

ColumnHeaderFilter.displayName = 'ColumnHeaderFilter';
