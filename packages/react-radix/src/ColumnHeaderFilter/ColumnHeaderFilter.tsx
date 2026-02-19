import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { IColumnHeaderFilterProps } from '@alaarab/ogrid-react';
import {
  useColumnHeaderFilterState,
  getColumnHeaderFilterStateParams,
  DateFilterContent,
  renderFilterContent,
} from '@alaarab/ogrid-react';
import type { FilterContentRenderers } from '@alaarab/ogrid-react';
import { TextFilterPopover } from './TextFilterPopover';
import { MultiSelectFilterPopover } from './MultiSelectFilterPopover';
import { PeopleFilterPopover } from './PeopleFilterPopover';
import styles from './ColumnHeaderFilter.module.scss';

export type { IColumnHeaderFilterProps };

function FilterIcon(): React.ReactElement {
  return <span aria-hidden>{'\u25BE'}</span>;
}

const radixRenderers: FilterContentRenderers = {
  renderMultiSelect: (p) => (
    <MultiSelectFilterPopover
      searchText={p.searchText}
      onSearchChange={p.onSearchChange}
      options={p.options}
      filteredOptions={p.filteredOptions}
      selected={p.selected}
      onOptionToggle={p.onOptionToggle}
      onSelectAll={p.onSelectAll}
      onClearSelection={p.onClearSelection}
      onApply={p.onApply}
      isLoading={p.isLoading}
    />
  ),
  renderText: (p) => (
    <TextFilterPopover
      value={p.value}
      onValueChange={p.onValueChange}
      onApply={p.onApply}
      onClear={p.onClear}
    />
  ),
  renderPeople: (p) => (
    <PeopleFilterPopover
      selectedUser={p.selectedUser}
      searchText={p.searchText}
      onSearchChange={p.onSearchChange}
      suggestions={p.suggestions}
      isLoading={p.isLoading}
      onUserSelect={p.onUserSelect}
      onClearUser={p.onClearUser}
      inputRef={p.inputRef}
    />
  ),
  renderDate: (p) => (
    <DateFilterContent
      tempDateFrom={p.tempDateFrom}
      setTempDateFrom={p.setTempDateFrom}
      tempDateTo={p.tempDateTo}
      setTempDateTo={p.setTempDateTo}
      onApply={p.onApply}
      onClear={p.onClear}
      classNames={{
        popoverActions: styles.popoverActions,
        clearButton: styles.clearButton,
        applyButton: styles.applyButton,
      }}
    />
  ),
};

export const ColumnHeaderFilter: React.FC<IColumnHeaderFilterProps> = React.memo((props) => {
  const {
    columnName,
    filterType,
    options = [],
    isLoadingOptions = false,
    selectedUser,
  } = props;

  const state = useColumnHeaderFilterState(getColumnHeaderFilterStateParams(props));

  const {
    headerRef,
    popoverRef,
    isFilterOpen,
    setFilterOpen,
    hasActiveFilter,
    handlers,
  } = state;

  return (
    <div className={styles.columnHeader} ref={headerRef as React.RefObject<HTMLDivElement>}>
      <div className={styles.headerContent}>
        <span className={styles.columnName} title={columnName} data-header-label>
          {columnName}
        </span>
      </div>
      <div className={styles.headerActions}>
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
                {renderFilterContent(filterType, state, options ?? [], isLoadingOptions, selectedUser, radixRenderers)}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
    </div>
  );
});

ColumnHeaderFilter.displayName = 'ColumnHeaderFilter';
