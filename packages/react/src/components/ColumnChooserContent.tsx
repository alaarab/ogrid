/**
 * Shared inner content for ColumnChooser dropdowns across all React UI packages.
 * Each UI package provides its own popover/dropdown wrapper and CheckboxItem slot.
 * Optional Header, OptionsListContainer, OptionItemContainer, and Actions slots
 * allow framework-specific wrappers (e.g. MUI Box/Typography) for Material.
 */

import * as React from 'react';
import type { IColumnDefinition } from '../types/columnTypes';

// ---- Slot prop types ----

export interface IColumnChooserCheckboxItemProps {
  columnId: string;
  columnName: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

export interface IColumnChooserActionsProps {
  onClearAll: () => void;
  onSelectAll: () => void;
}

export interface IColumnChooserHeaderProps {
  visibleCount: number;
  totalCount: number;
}

// ---- ClassNames ----

export interface ColumnChooserContentClassNames {
  header?: string;
  optionsList?: string;
  optionItem?: string;
  actions?: string;
  clearButton?: string;
  selectAllButton?: string;
}

// ---- Props ----

export interface ColumnChooserContentProps {
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  visibleCount: number;
  totalCount: number;
  handleSelectAll: () => void;
  handleClearAll: () => void;
  /** Curried handler: (columnId) => (checked: boolean) => void */
  handleCheckboxChange: (columnId: string) => (checked: boolean) => void;
  CheckboxItem: React.ComponentType<IColumnChooserCheckboxItemProps>;
  classNames?: ColumnChooserContentClassNames;
  // Optional slots for framework-specific container overrides (e.g. Material's Box/Typography)
  Header?: React.ComponentType<IColumnChooserHeaderProps>;
  OptionsListContainer?: React.ComponentType<{ children: React.ReactNode }>;
  OptionItemContainer?: React.ComponentType<{ columnId: string; children: React.ReactNode }>;
  Actions?: React.ComponentType<IColumnChooserActionsProps>;
}

export const ColumnChooserContent: React.FC<ColumnChooserContentProps> = ({
  columns,
  visibleColumns,
  visibleCount,
  totalCount,
  handleSelectAll,
  handleClearAll,
  handleCheckboxChange,
  CheckboxItem,
  classNames: cn = {},
  Header,
  OptionsListContainer,
  OptionItemContainer,
  Actions,
}) => {
  const headerNode = Header
    ? <Header visibleCount={visibleCount} totalCount={totalCount} />
    : <div className={cn.header}>Select Columns ({visibleCount} of {totalCount})</div>;

  const optionItems = columns.map((column) => {
    const checkboxItem = (
      <CheckboxItem
        columnId={column.columnId}
        columnName={column.name}
        checked={visibleColumns.has(column.columnId)}
        disabled={column.required === true}
        onChange={handleCheckboxChange(column.columnId)}
      />
    );
    if (OptionItemContainer) {
      return (
        <OptionItemContainer key={column.columnId} columnId={column.columnId}>
          {checkboxItem}
        </OptionItemContainer>
      );
    }
    return <div key={column.columnId} className={cn.optionItem}>{checkboxItem}</div>;
  });

  const listNode = OptionsListContainer
    ? <OptionsListContainer>{optionItems}</OptionsListContainer>
    : <div className={cn.optionsList}>{optionItems}</div>;

  const actionsNode = Actions
    ? <Actions onClearAll={handleClearAll} onSelectAll={handleSelectAll} />
    : (
      <div className={cn.actions}>
        <button type="button" className={cn.clearButton} onClick={handleClearAll}>Clear All</button>
        <button type="button" className={cn.selectAllButton} onClick={handleSelectAll}>Select All</button>
      </div>
    );

  return <>{headerNode}{listNode}{actionsNode}</>;
};

ColumnChooserContent.displayName = 'ColumnChooserContent';
