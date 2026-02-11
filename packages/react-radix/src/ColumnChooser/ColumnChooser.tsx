import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import type { IColumnDefinition } from '@alaarab/ogrid-react';
import { useColumnChooserState } from '@alaarab/ogrid-react';
import styles from './ColumnChooser.module.scss';

export type { IColumnDefinition };

export interface IColumnChooserProps {
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, visible: boolean) => void;
  className?: string;
}

function TableSettingsIcon(): React.ReactElement {
  return (
    <span className={styles.buttonIcon} aria-hidden>
      ⚙
    </span>
  );
}
function ChevronDown(): React.ReactElement {
  return <span className={styles.chevron} aria-hidden>▼</span>;
}
function ChevronUp(): React.ReactElement {
  return <span className={styles.chevron} aria-hidden>▲</span>;
}

export const ColumnChooser: React.FC<IColumnChooserProps> = (props) => {
  const { columns, visibleColumns, onVisibilityChange, className } = props;

  const {
    open,
    setOpen,
    handleCheckboxChange: setColumnVisible,
    handleSelectAll,
    handleClearAll,
    visibleCount,
    totalCount,
  } = useColumnChooserState({ columns, visibleColumns, onVisibilityChange });

  const handleCheckboxChange = (columnKey: string) => (checked: boolean | 'indeterminate') => {
    setColumnVisible(columnKey)(checked === true);
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={styles.triggerButton}
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <TableSettingsIcon />
            <span>
              Column Visibility ({visibleCount} of {totalCount})
            </span>
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
            <div className={styles.header}>Select Columns ({visibleCount} of {totalCount})</div>
            <div className={styles.optionsList}>
              {columns.map((column) => (
                <div key={column.columnId} className={styles.optionItem}>
                  <Checkbox.Root
                    id={`col-${column.columnId}`}
                    checked={visibleColumns.has(column.columnId)}
                    onCheckedChange={handleCheckboxChange(column.columnId)}
                    disabled={column.required === true}
                    className={styles.checkbox}
                  >
                    <Checkbox.Indicator className={styles.checkboxIndicator}>✓</Checkbox.Indicator>
                  </Checkbox.Root>
                  <label htmlFor={`col-${column.columnId}`} style={{ marginLeft: 8, cursor: 'pointer' }}>
                    {column.name}
                  </label>
                </div>
              ))}
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.clearButton} onClick={handleClearAll}>
                Clear All
              </button>
              <button type="button" className={styles.selectAllButton} onClick={handleSelectAll}>
                Select All
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};
