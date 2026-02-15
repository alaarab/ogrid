import * as React from 'react';
import { Input } from '@fluentui/react-components';
import { SearchRegular } from '@fluentui/react-icons';
import styles from './ColumnHeaderFilter.module.scss';

export interface TextFilterPopoverProps {
  value: string;
  onValueChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onPopoverClick: (e: React.MouseEvent) => void;
  onInputFocus: (e: React.FocusEvent) => void;
  onInputMouseDown: (e: React.MouseEvent) => void;
  onInputClick: (e: React.MouseEvent) => void;
  onInputKeyDown: (e: React.KeyboardEvent) => void;
}

export const TextFilterPopover: React.FC<TextFilterPopoverProps> = ({
  value,
  onValueChange,
  onApply,
  onClear,
  onPopoverClick,
  onInputFocus,
  onInputMouseDown,
  onInputClick,
  onInputKeyDown,
}) => (
  <>
    <div className={styles.popoverSearch} onClick={onPopoverClick}>
      <Input
        placeholder="Enter search term..."
        value={value}
        onChange={(e, data) => onValueChange(data.value ?? '')}
        onKeyDown={(e: React.KeyboardEvent) => {
          onInputKeyDown(e);
          if (e.key === 'Enter') {
            e.preventDefault();
            onApply();
          }
        }}
        onFocus={onInputFocus}
        onMouseDown={onInputMouseDown}
        onClick={onInputClick}
        autoComplete="off"
        className={styles.searchInput}
        contentBefore={<SearchRegular />}
      />
    </div>
    <div className={styles.popoverActions} onClick={onPopoverClick}>
      <button type="button" className={styles.clearButton} onClick={onClear} disabled={!value}>
        Clear
      </button>
      <button type="button" className={styles.applyButton} onClick={onApply}>
        Apply
      </button>
    </div>
  </>
);

TextFilterPopover.displayName = 'TextFilterPopover';
