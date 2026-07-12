import * as React from 'react';
import { SearchRegular } from '@fluentui/react-icons';
import { useListVirtualizer } from '@alaarab/ogrid-react';
import styles from './ColumnHeaderFilter.module.scss';

const ITEM_HEIGHT = 40;

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
  onPopoverClick: (e: React.MouseEvent) => void;
  onInputFocus: (e: React.FocusEvent) => void;
  onInputMouseDown: (e: React.MouseEvent) => void;
  onInputClick: (e: React.MouseEvent) => void;
  onInputKeyDown: (e: React.KeyboardEvent) => void;
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
  onPopoverClick,
  onInputFocus,
  onInputMouseDown,
  onInputClick,
  onInputKeyDown,
}) => {
  const virt = useListVirtualizer({ count: filteredOptions.length, itemHeight: ITEM_HEIGHT });

  return (
    <>
      <div className={styles.popoverSearch} onClick={onPopoverClick}>
        <div className={styles.nativeInputWrapper}>
          <SearchRegular className={styles.nativeInputIcon} />
          <input
            type="text"
            placeholder="Search..."
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={onInputFocus}
            onMouseDown={onInputMouseDown}
            onClick={onInputClick}
            onKeyDown={onInputKeyDown}
            autoComplete="off"
            className={styles.nativeInput}
          />
        </div>
        <div className={styles.resultCount}>
          {filteredOptions.length} of {options.length} options
        </div>
      </div>
      <div className={styles.selectAllRow} onClick={onPopoverClick}>
        <button type="button" className={styles.selectAllButton} onClick={onSelectAll}>
          Select All ({filteredOptions.length})
        </button>
        <button type="button" className={styles.selectAllButton} onClick={onClearSelection}>
          Clear
        </button>
      </div>
      <div
        ref={virt.containerRef}
        onScroll={virt.onScroll}
        className={styles.popoverOptions}
        onClick={onPopoverClick}
      >
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.filterSpinner} />
            <span style={{ fontSize: 12, color: 'var(--colorNeutralForeground2, #616161)' }}>Loading...</span>
          </div>
        ) : filteredOptions.length === 0 ? (
          <div className={styles.noResults}>No options found</div>
        ) : (
          <div style={{ height: virt.totalHeight, position: 'relative' }}>
            {virt.visibleItems.map(({ index, offsetTop }) => {
              const option = filteredOptions[index];
              if (option === undefined) return null;
              const isChecked = selected.has(option);
              return (
                <label
                  key={option}
                  className={styles.popoverOption}
                  style={{ position: 'absolute', top: offsetTop, width: '100%', height: ITEM_HEIGHT, boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(ev) => {
                      ev.stopPropagation();
                      onOptionToggle(option, ev.target.checked);
                    }}
                    className={styles.nativeCheckbox}
                  />
                  <span className={styles.checkboxLabel}>{option}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
      <div className={styles.popoverActions} onClick={onPopoverClick}>
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
