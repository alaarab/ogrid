import * as React from 'react';
import { Popover, PopoverSurface, type OpenPopoverEvents, type OnOpenChangeData } from '@fluentui/react-components';
import { ArrowUpRegular, ArrowDownRegular, ArrowSortRegular, FilterRegular } from '@fluentui/react-icons';
import type { IColumnHeaderFilterProps } from '@alaarab/ogrid-react';
import {
  useColumnHeaderFilterState,
  getColumnHeaderFilterStateParams,
  DateFilterContent,
} from '@alaarab/ogrid-react';
import { TextFilterPopover } from './TextFilterPopover';
import { MultiSelectFilterPopover } from './MultiSelectFilterPopover';
import { PeopleFilterPopover } from './PeopleFilterPopover';
import styles from './ColumnHeaderFilter.module.scss';

export type { IColumnHeaderFilterProps };

export const ColumnHeaderFilter: React.FC<IColumnHeaderFilterProps> = React.memo((props) => {
  const {
    columnName,
    filterType,
    isSorted = false,
    isSortedDescending = false,
    onSort,
    options,
    isLoadingOptions = false,
    selectedUser,
  } = props;

  const state = useColumnHeaderFilterState(getColumnHeaderFilterStateParams(props));

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
          <DateFilterContent
            tempDateFrom={state.tempDateFrom}
            setTempDateFrom={state.setTempDateFrom}
            tempDateTo={state.tempDateTo}
            setTempDateTo={state.setTempDateTo}
            onApply={handlers.handleDateApply}
            onClear={handlers.handleDateClear}
            classNames={{
              popoverActions: styles.popoverActions,
              clearButton: styles.clearButton,
              applyButton: styles.applyButton,
            }}
          />
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
              onOpenChange={(_: OpenPopoverEvents, data: OnOpenChangeData) => { if (!data.open) setFilterOpen(false); }}
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
