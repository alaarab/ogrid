import * as React from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import styles from './ColumnHeaderFilter.module.scss';

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
}) => (
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
    <div className={styles.popoverOptions}>
      {isLoading ? (
        <div className={styles.loadingContainer}>Loading...</div>
      ) : filteredOptions.length === 0 ? (
        <div className={styles.noResults}>No options found</div>
      ) : (
        filteredOptions.map((option) => (
          <div key={option} className={styles.popoverOption}>
            <Checkbox.Root
              checked={selected.has(option)}
              onCheckedChange={(c: boolean | 'indeterminate') =>
                onOptionToggle(option, c === true)
              }
              className={styles.filterCheckbox}
            >
              <Checkbox.Indicator>✓</Checkbox.Indicator>
            </Checkbox.Root>
            <label style={{ marginLeft: 8, cursor: 'pointer' }}>{option}</label>
          </div>
        ))
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

MultiSelectFilterPopover.displayName = 'MultiSelectFilterPopover';
