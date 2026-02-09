import * as React from 'react';
import styles from './ColumnHeaderFilter.module.scss';

export interface TextFilterPopoverProps {
  value: string;
  onValueChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
}

export const TextFilterPopover: React.FC<TextFilterPopoverProps> = ({
  value,
  onValueChange,
  onApply,
  onClear,
}) => (
  <>
    <div className={styles.popoverSearch}>
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Enter search term..."
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onApply())}
        autoComplete="off"
      />
    </div>
    <div className={styles.popoverActions}>
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
