import * as React from 'react';
import { useRef, useEffect } from 'react';
import {
  Button,
  Checkbox,
} from '@fluentui/react-components';
import type { CheckboxOnChangeData } from '@fluentui/react-components';
import { TableSettingsRegular, ChevronDownRegular, ChevronUpRegular } from '@fluentui/react-icons';
import type { IColumnChooserProps } from '@alaarab/ogrid-react';
import { useColumnChooserState } from '@alaarab/ogrid-react';
import styles from './ColumnChooser.module.scss';

export type { IColumnChooserProps };

export const ColumnChooser: React.FC<IColumnChooserProps> = (props) => {
  const { columns, visibleColumns, onVisibilityChange, className } = props;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    open,
    handleToggle,
    handleClose,
    handleCheckboxChange: setColumnVisible,
    handleSelectAll,
    handleClearAll,
    visibleCount,
    totalCount,
  } = useColumnChooserState({ columns, visibleColumns, onVisibilityChange });

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        handleClose();
      }
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, handleClose]);

  const handleCheckboxChange = (columnKey: string) =>
    (_ev: React.ChangeEvent<HTMLInputElement>, data: CheckboxOnChangeData) => {
      setColumnVisible(columnKey)(data.checked === true);
    };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <Button
        ref={buttonRef}
        appearance="outline"
        icon={<TableSettingsRegular />}
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        Column Visibility ({visibleCount} of {totalCount})
        {open ? <ChevronUpRegular /> : <ChevronDownRegular />}
      </Button>

      {open && (
        <div ref={dropdownRef} className={styles.dropdown}>
          <div className={styles.header}>
            Select Columns ({visibleCount} of {totalCount})
          </div>
          <div className={styles.optionsList}>
            {columns.map((column) => (
              <div key={column.columnId} className={styles.optionItem}>
                <Checkbox
                  label={column.name}
                  checked={visibleColumns.has(column.columnId)}
                  onChange={handleCheckboxChange(column.columnId)}
                />
              </div>
            ))}
          </div>
          <div className={styles.actions}>
            <Button appearance="subtle" size="small" onClick={handleClearAll}>
              Clear All
            </Button>
            <Button appearance="primary" size="small" onClick={handleSelectAll}>
              Select All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
