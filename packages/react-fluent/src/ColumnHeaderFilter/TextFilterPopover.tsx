import * as React from 'react';
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
    {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick only stops propagation so clicks inside the popover do not reach the column header; inner controls are natively interactive */}
    {/* biome-ignore lint/a11y/noStaticElementInteractions: onClick only stops propagation; inner controls are natively interactive */}
    {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: onClick only stops propagation; inner controls are natively interactive */}
    <div className={styles.popoverSearch} onClick={onPopoverClick}>
      <div className={styles.nativeInputWrapper}>
        <SearchRegular className={styles.nativeInputIcon} />
        <input
          type="text"
          placeholder="Enter search term..."
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
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
          className={styles.nativeInput}
        />
      </div>
    </div>
    {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick only stops propagation so clicks inside the popover do not reach the column header; inner controls are natively interactive */}
    {/* biome-ignore lint/a11y/noStaticElementInteractions: onClick only stops propagation; inner controls are natively interactive */}
    {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: onClick only stops propagation; inner controls are natively interactive */}
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
