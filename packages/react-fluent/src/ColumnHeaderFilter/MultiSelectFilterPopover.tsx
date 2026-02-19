import * as React from 'react';
import { Input, Checkbox } from '@fluentui/react-components';
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
        <Input
          placeholder="Search..."
          value={searchText}
          onChange={(e, data) => onSearchChange(data.value ?? '')}
          onFocus={onInputFocus}
          onMouseDown={onInputMouseDown}
          onClick={onInputClick}
          onKeyDown={onInputKeyDown}
          autoComplete="off"
          className={styles.searchInput}
          contentBefore={<SearchRegular />}
        />
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
              return (
                <div key={option} className={styles.popoverOption} style={{ position: 'absolute', top: offsetTop, width: '100%', height: ITEM_HEIGHT, boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    label={option}
                    checked={selected.has(option)}
                    onChange={(ev, data) => {
                      ev.stopPropagation();
                      onOptionToggle(option, data.checked === true);
                    }}
                  />
                </div>
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
