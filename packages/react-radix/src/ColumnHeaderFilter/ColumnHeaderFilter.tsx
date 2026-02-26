import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { IColumnHeaderFilterProps } from '@alaarab/ogrid-react';
import {
  useColumnHeaderFilterState,
  getColumnHeaderFilterStateParams,
  renderFilterContent,
  createBaseFilterRenderers,
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

const radixRenderers: FilterContentRenderers = createBaseFilterRenderers(
  { MultiSelectFilterPopover, TextFilterPopover, PeopleFilterPopover },
  { popoverActions: styles.popoverActions, clearButton: styles.clearButton, applyButton: styles.applyButton }
);

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
