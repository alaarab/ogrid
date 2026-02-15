import * as React from 'react';
import { Popover, PopoverSurface } from '@fluentui/react-components';
import { ArrowUpRegular, ArrowDownRegular, ArrowSortRegular, FilterRegular } from '@fluentui/react-icons';
import type { UserLike, ColumnFilterType, IDateFilterValue } from '@alaarab/ogrid-react';
import { useColumnHeaderFilterState } from '@alaarab/ogrid-react';
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
  dateValue?: IDateFilterValue;
  onDateChange?: (value: IDateFilterValue | undefined) => void;
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
    dateValue,
    onDateChange,
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
    dateValue,
    onDateChange,
  });

  const {
    headerRef,
    popoverRef,
    peopleInputRef,
    isFilterOpen,
    setFilterOpen,
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
    handlers,
  } = state;

  const filterBtnRef = React.useRef<HTMLButtonElement>(null);

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
    if (filterType === 'date') {
      return (
        <div onClick={handlers.handlePopoverClick}>
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              From:
              <input type="date" value={state.tempDateFrom} onChange={(e) => state.setTempDateFrom(e.target.value)} style={{ flex: 1 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              To:
              <input type="date" value={state.tempDateTo} onChange={(e) => state.setTempDateTo(e.target.value)} style={{ flex: 1 }} />
            </label>
          </div>
          <div className={styles.popoverActions}>
            <button className={styles.clearButton} onClick={handlers.handleDateClear} disabled={!state.tempDateFrom && !state.tempDateTo}>Clear</button>
            <button className={styles.applyButton} onClick={handlers.handleDateApply}>Apply</button>
          </div>
        </div>
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
            {isSorted ? (
              isSortedDescending ? <ArrowDownRegular /> : <ArrowUpRegular />
            ) : (
              <ArrowSortRegular />
            )}
          </button>
        )}

        {filterType !== 'none' && (
          <>
            <button
              ref={filterBtnRef}
              type="button"
              className={`${styles.filterIcon} ${hasActiveFilter ? styles.filterActive : ''} ${isFilterOpen ? styles.filterOpen : ''}`}
              onClick={handlers.handleFilterIconClick}
              aria-label={`Filter ${columnName}`}
              title={`Filter ${columnName}`}
            >
              <FilterRegular />
              {hasActiveFilter && <span className={styles.filterBadge} />}
            </button>
            <Popover
              open={isFilterOpen}
              onOpenChange={(_: any, data: any) => { if (!data.open) setFilterOpen(false); }}
              positioning={{ target: filterBtnRef.current ?? undefined, position: 'below', align: 'start', offset: 4 }}
              trapFocus={false}
            >
              <PopoverSurface
                ref={popoverRef as React.RefObject<HTMLDivElement>}
                className={styles.filterPopover}
                onClick={handlers.handlePopoverClick}
                style={{ padding: 0 }}
              >
                <div className={styles.popoverHeader}>Filter: {columnName}</div>
                {renderPopoverContent()}
              </PopoverSurface>
            </Popover>
          </>
        )}
      </div>
    </div>
  );
});

ColumnHeaderFilter.displayName = 'ColumnHeaderFilter';
