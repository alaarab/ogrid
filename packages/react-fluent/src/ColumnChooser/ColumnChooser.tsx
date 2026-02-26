import * as React from 'react';
import { useRef, useEffect } from 'react';
import { Button, Checkbox } from '@fluentui/react-components';
import type { CheckboxOnChangeData } from '@fluentui/react-components';
import { TableSettingsRegular, ChevronDownRegular, ChevronUpRegular } from '@fluentui/react-icons';
import type { IColumnChooserProps } from '@alaarab/ogrid-react';
import {
  useColumnChooserState,
  ColumnChooserContent,
  type IColumnChooserCheckboxItemProps,
  type IColumnChooserActionsProps,
  type ColumnChooserContentClassNames,
} from '@alaarab/ogrid-react';
import styles from './ColumnChooser.module.scss';

export type { IColumnChooserProps };

const CheckboxItem: React.FC<IColumnChooserCheckboxItemProps> = ({ columnId, columnName, checked, disabled, onChange }) => (
  <Checkbox
    id={`col-${columnId}`}
    label={columnName}
    checked={checked}
    onChange={(_ev: React.ChangeEvent<HTMLInputElement>, data: CheckboxOnChangeData) => onChange(data.checked === true)}
    disabled={disabled}
  />
);

const Actions: React.FC<IColumnChooserActionsProps> = ({ onClearAll, onSelectAll }) => (
  <div className={styles.actions}>
    <Button appearance="subtle" size="small" onClick={onClearAll}>Clear All</Button>
    <Button appearance="primary" size="small" onClick={onSelectAll}>Select All</Button>
  </div>
);

const CLASS_NAMES: ColumnChooserContentClassNames = {
  header: styles.header,
  optionsList: styles.optionsList,
  optionItem: styles.optionItem,
};

export const ColumnChooser: React.FC<IColumnChooserProps> = (props) => {
  const { columns, visibleColumns, onVisibilityChange, onSetVisibleColumns, className } = props;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    open, handleToggle, handleClose,
    handleCheckboxChange: setColumnVisible,
    handleSelectAll, handleClearAll,
    visibleCount, totalCount,
  } = useColumnChooserState({ columns, visibleColumns, onVisibilityChange, onSetVisibleColumns });

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
    const timeoutId = setTimeout(() => { document.addEventListener('mousedown', handleClickOutside); }, 0);
    return () => { clearTimeout(timeoutId); document.removeEventListener('mousedown', handleClickOutside); };
  }, [open, handleClose]);

  const handleCheckboxChange = (columnKey: string) => (checked: boolean) => setColumnVisible(columnKey)(checked);

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
          <ColumnChooserContent
            columns={columns}
            visibleColumns={visibleColumns}
            visibleCount={visibleCount}
            totalCount={totalCount}
            handleSelectAll={handleSelectAll}
            handleClearAll={handleClearAll}
            handleCheckboxChange={handleCheckboxChange}
            CheckboxItem={CheckboxItem}
            classNames={CLASS_NAMES}
            Actions={Actions}
          />
        </div>
      )}
    </div>
  );
};
