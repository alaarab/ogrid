import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
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

function SortIcon({ isSorted, isDesc }: { isSorted: boolean; isDesc: boolean }): React.ReactElement {
  if (isSorted) return <span aria-hidden>{isDesc ? '\u2193' : '\u2191'}</span>;
  return <span aria-hidden>{'\u21C5'}</span>;
}
function FilterIcon(): React.ReactElement {
  return <span aria-hidden>{'\u25BE'}</span>;
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
    options = [],
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
    setFilterOpen,
    tempSelected,
    tempTextValue,
    setTempTextValue,
    searchText,
    setSearchText,
    filteredOptions,
    peopleSuggestions,
    isPeopleLoading,
    peopleSearchText,
    setPeopleSearchText,
    hasActiveFilter,
    handlers,
  } = state;

  const safeOptions = options ?? [];

  const renderPopoverContent = (): React.ReactNode => {
    if (filterType === 'multiSelect') {
      return (
        <MultiSelectFilterPopover
          searchText={searchText}
          onSearchChange={setSearchText}
          options={safeOptions}
          filteredOptions={filteredOptions}
          selected={tempSelected}
          onOptionToggle={handlers.handleCheckboxChange}
          onSelectAll={handlers.handleSelectAll}
          onClearSelection={handlers.handleClearSelection}
          onApply={handlers.handleApplyMultiSelect}
          isLoading={isLoadingOptions}
        />
      );
    }
    if (filterType === 'text') {
      return (
        <TextFilterPopover
          value={tempTextValue}
          onValueChange={setTempTextValue}
          onApply={handlers.handleTextApply}
          onClear={handlers.handleTextClear}
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
          inputRef={peopleInputRef}
        />
      );
    }
    return null;
  };

  return (
    <div className={styles.columnHeader} ref={headerRef as React.RefObject<HTMLDivElement>}>
      <div className={styles.headerContent}>
        <span className={styles.columnName} title={columnName} data-header-label>
          {columnName}
        </span>
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
            <SortIcon isSorted={isSorted} isDesc={isSortedDescending} />
          </button>
        )}
        {filterType !== 'none' && (
          <Popover.Root open={isFilterOpen} onOpenChange={setFilterOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className={`${styles.filterIcon} ${hasActiveFilter ? styles.filterActive : ''} ${isFilterOpen ? styles.filterOpen : ''}`}
                onClick={handlers.handleFilterIconClick}
                aria-label={`Filter ${columnName}`}
                title={`Filter ${columnName}`}
              >
                <FilterIcon />
                {hasActiveFilter && <span className={styles.filterBadge} />}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                ref={popoverRef as React.RefObject<HTMLDivElement>}
                className={styles.popoverContent}
                sideOffset={4}
                align="start"
                onOpenAutoFocus={(e: Event) => e.preventDefault()}
              >
                <div className={styles.popoverHeader}>Filter: {columnName}</div>
                {renderPopoverContent()}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
    </div>
  );
});

ColumnHeaderFilter.displayName = 'ColumnHeaderFilter';
