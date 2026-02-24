import * as React from 'react';
import { Popover, PopoverSurface, type OpenPopoverEvents, type OnOpenChangeData } from '@fluentui/react-components';
import { FilterRegular } from '@fluentui/react-icons';
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

export const ColumnHeaderFilter: React.FC<IColumnHeaderFilterProps> = React.memo((props) => {
  const {
    columnName,
    filterType,
    options,
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

  const {
    handlePopoverClick,
    handleInputFocus,
    handleInputMouseDown,
    handleInputClick,
    handleInputKeyDown,
  } = handlers;

  const filterBtnRef = React.useRef<HTMLButtonElement>(null);

  // Fluent-specific renderers that pass additional event propagation handlers
  const fluentRenderers: FilterContentRenderers = React.useMemo(() => ({
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
        onPopoverClick={handlePopoverClick}
        onInputFocus={handleInputFocus}
        onInputMouseDown={handleInputMouseDown}
        onInputClick={handleInputClick}
        onInputKeyDown={handleInputKeyDown}
      />
    ),
    renderText: (p) => (
      <TextFilterPopover
        value={p.value}
        onValueChange={p.onValueChange}
        onApply={p.onApply}
        onClear={p.onClear}
        onPopoverClick={handlePopoverClick}
        onInputFocus={handleInputFocus}
        onInputMouseDown={handleInputMouseDown}
        onInputClick={handleInputClick}
        onInputKeyDown={handleInputKeyDown}
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
        onPopoverClick={handlePopoverClick}
        inputRef={p.inputRef as React.RefObject<HTMLInputElement>}
      />
    ),
    renderDate: (p) => (
      <div onClick={handlePopoverClick}>
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
      </div>
    ),
  }), [handlePopoverClick, handleInputFocus, handleInputMouseDown, handleInputClick, handleInputKeyDown]);

  return (
    <div className={styles.columnHeader} ref={headerRef as React.RefObject<HTMLDivElement>}>
      <div className={styles.headerContent}>
        <span className={styles.columnName} title={columnName} data-header-label>
          {columnName}
        </span>
      </div>

      <div className={styles.headerActions}>
        {filterType !== 'none' && (
          <>
            <button
              ref={filterBtnRef}
              type="button"
              className={`${styles.filterIcon} ${hasActiveFilter ? styles.filterActive : ''} ${isFilterOpen ? styles.filterOpen : ''}`}
              onClick={handlers.handleFilterIconClick}
              aria-label={`Filter ${columnName}`}
              aria-expanded={isFilterOpen}
              aria-haspopup="dialog"
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
                {renderFilterContent(filterType, state, options ?? [], isLoadingOptions, selectedUser, fluentRenderers)}
              </PopoverSurface>
            </Popover>
          </>
        )}
      </div>
    </div>
  );
});

ColumnHeaderFilter.displayName = 'ColumnHeaderFilter';
