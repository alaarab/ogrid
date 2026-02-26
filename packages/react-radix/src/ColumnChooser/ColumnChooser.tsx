import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import type { IColumnChooserProps } from '@alaarab/ogrid-react';
import {
  useColumnChooserState,
  ColumnChooserContent,
  type IColumnChooserCheckboxItemProps,
  type ColumnChooserContentClassNames,
} from '@alaarab/ogrid-react';
import styles from './ColumnChooser.module.scss';

export type { IColumnChooserProps };

function TableSettingsIcon(): React.ReactElement {
  return <span className={styles.buttonIcon} aria-hidden>⚙</span>;
}
function ChevronDown(): React.ReactElement {
  return <span className={styles.chevron} aria-hidden>▼</span>;
}
function ChevronUp(): React.ReactElement {
  return <span className={styles.chevron} aria-hidden>▲</span>;
}

const CheckboxItem: React.FC<IColumnChooserCheckboxItemProps> = ({ columnId, columnName, checked, disabled, onChange }) => (
  <>
    <Checkbox.Root
      id={`col-${columnId}`}
      checked={checked}
      onCheckedChange={(c) => onChange(c === true)}
      disabled={disabled}
      className={styles.checkbox}
    >
      <Checkbox.Indicator className={styles.checkboxIndicator}>✓</Checkbox.Indicator>
    </Checkbox.Root>
    <label htmlFor={`col-${columnId}`} style={{ marginLeft: 8, cursor: 'pointer' }}>{columnName}</label>
  </>
);

const CLASS_NAMES: ColumnChooserContentClassNames = {
  header: styles.header,
  optionsList: styles.optionsList,
  optionItem: styles.optionItem,
  actions: styles.actions,
  clearButton: styles.clearButton,
  selectAllButton: styles.selectAllButton,
};

export const ColumnChooser: React.FC<IColumnChooserProps> = (props) => {
  const { columns, visibleColumns, onVisibilityChange, onSetVisibleColumns, className } = props;

  const {
    open, setOpen,
    handleCheckboxChange: setColumnVisible,
    handleSelectAll, handleClearAll,
    visibleCount, totalCount,
  } = useColumnChooserState({ columns, visibleColumns, onVisibilityChange, onSetVisibleColumns });

  const handleCheckboxChange = (columnKey: string) => (checked: boolean) => setColumnVisible(columnKey)(checked);

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button type="button" className={styles.triggerButton} aria-expanded={open} aria-haspopup="listbox">
            <TableSettingsIcon />
            <span>Column Visibility ({visibleCount} of {totalCount})</span>
            {open ? <ChevronUp /> : <ChevronDown />}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={styles.dropdown}
            sideOffset={4}
            align="end"
            onOpenAutoFocus={(e: Event) => e.preventDefault()}
          >
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
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};
