import * as React from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import { useListVirtualizer } from '@alaarab/ogrid-react';
import styles from './ColumnHeaderFilter.module.scss';

const ITEM_HEIGHT = 34;

export interface MultiSelectFilterPopoverProps {
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

export const MultiSelectFilterPopover: React.FC<MultiSelectFilterPopoverProps> = ({
  searchText,
  onSearchChange,
  options,
  filteredOptions,
  selected,
  onOptionToggle,
  onSelectAll,
  onClearSelection,
  onApply,
  isLoading,
}) => {
  const virt = useListVirtualizer({ count: filteredOptions.length, itemHeight: ITEM_HEIGHT });
  const optionIdPrefix = React.useId();

  return (
    <>
      <div className={styles.popoverSearch}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search..."
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
        />
        <div className={styles.resultCount}>
          {filteredOptions.length} of {options.length} options
        </div>
      </div>
      <div className={styles.selectAllRow}>
        <button type="button" className={styles.selectAllButton} onClick={onSelectAll}>
          Select All ({filteredOptions.length})
        </button>
        <button type="button" className={styles.selectAllButton} onClick={onClearSelection}>
          Clear
        </button>
      </div>
      <div ref={virt.containerRef} onScroll={virt.onScroll} className={styles.popoverOptions}>
        {isLoading ? (
          <div className={styles.loadingContainer}>Loading...</div>
        ) : filteredOptions.length === 0 ? (
          <div className={styles.noResults}>No options found</div>
        ) : (
          <div style={{ height: virt.totalHeight, position: 'relative' }}>
            {virt.visibleItems.map(({ index, offsetTop }) => {
              const option = filteredOptions[index];
              if (option === undefined) return null;
              const optionId = `${optionIdPrefix}-${index}`;
              return (
                <div key={option} className={styles.popoverOption} style={{ position: 'absolute', top: offsetTop, width: '100%', height: ITEM_HEIGHT, boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>
                  <Checkbox.Root
                    id={optionId}
                    checked={selected.has(option)}
                    onCheckedChange={(c: boolean | 'indeterminate') =>
                      onOptionToggle(option, c === true)
                    }
                    className={styles.filterCheckbox}
                  >
                    <Checkbox.Indicator>✓</Checkbox.Indicator>
                  </Checkbox.Root>
                  <label htmlFor={optionId} style={{ marginLeft: 8, cursor: 'pointer' }}>{option}</label>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className={styles.popoverActions}>
        <button type="button" className={styles.clearButton} onClick={onClearSelection}>
          Clear
        </button>
        <button type="button" className={styles.applyButton} onClick={onApply}>
          Apply
        </button>
      </div>
    </>
  );
};

MultiSelectFilterPopover.displayName = 'MultiSelectFilterPopover';
