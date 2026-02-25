/**
 * Shared filter content rendering for ColumnHeaderFilter across all React UI packages.
 * Each UI package provides its own popover wrapper + trigger; this component renders
 * the inner filter content (text, multiselect, people, date) given the shared state
 * from useColumnHeaderFilterState.
 */

import * as React from 'react';
import type { ColumnFilterType, IDateFilterValue } from '../types/columnTypes';
import type { UserLike } from '../types/dataGridTypes';
import type { UseColumnHeaderFilterStateResult } from '../hooks/useColumnHeaderFilterState';

// ---- Shared Props ----

export interface IColumnHeaderFilterProps {
  columnKey: string;
  columnName: string;
  filterType: ColumnFilterType;
  isSorted?: boolean;
  isSortedDescending?: boolean;
  onSort?: () => void;
  selectedValues?: string[];
  onFilterChange?: (values: string[]) => void;
  options?: string[];
  isLoadingOptions?: boolean;
  textValue?: string;
  onTextChange?: (value: string) => void;
  selectedUser?: UserLike;
  onUserChange?: (user: UserLike | undefined) => void;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
  dateValue?: IDateFilterValue;
  onDateChange?: (value: IDateFilterValue | undefined) => void;
}

// ---- Date Filter Content ----

const dateContainerStyle: React.CSSProperties = { padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 };
const dateLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 };
const dateInputFlexStyle: React.CSSProperties = { flex: 1 };

export interface DateFilterContentProps {
  tempDateFrom: string;
  setTempDateFrom: (v: string) => void;
  tempDateTo: string;
  setTempDateTo: (v: string) => void;
  onApply: () => void;
  onClear: () => void;
  classNames?: DateFilterClassNames;
}

export interface DateFilterClassNames {
  popoverActions?: string;
  clearButton?: string;
  applyButton?: string;
}

export const DateFilterContent: React.FC<DateFilterContentProps> = ({
  tempDateFrom,
  setTempDateFrom,
  tempDateTo,
  setTempDateTo,
  onApply,
  onClear,
  classNames,
}) => (
  <>
    <div style={dateContainerStyle}>
      <label style={dateLabelStyle}>
        From:
        <input type="date" value={tempDateFrom} onChange={(e) => setTempDateFrom(e.target.value)} style={dateInputFlexStyle} />
      </label>
      <label style={dateLabelStyle}>
        To:
        <input type="date" value={tempDateTo} onChange={(e) => setTempDateTo(e.target.value)} style={dateInputFlexStyle} />
      </label>
    </div>
    <div className={classNames?.popoverActions}>
      <button className={classNames?.clearButton} onClick={onClear} disabled={!tempDateFrom && !tempDateTo}>Clear</button>
      <button className={classNames?.applyButton} onClick={onApply}>Apply</button>
    </div>
  </>
);

DateFilterContent.displayName = 'DateFilterContent';

// ---- Utility to extract useColumnHeaderFilterState params from props ----

export function getColumnHeaderFilterStateParams(props: IColumnHeaderFilterProps) {
  return {
    filterType: props.filterType,
    onSort: props.onSort,
    selectedValues: props.selectedValues,
    onFilterChange: props.onFilterChange,
    options: props.options,
    isLoadingOptions: props.isLoadingOptions ?? false,
    textValue: props.textValue ?? '',
    onTextChange: props.onTextChange,
    selectedUser: props.selectedUser,
    onUserChange: props.onUserChange,
    peopleSearch: props.peopleSearch,
    dateValue: props.dateValue,
    onDateChange: props.onDateChange,
  };
}

// ---- Helper to build date filter props from state ----

export function getDateFilterContentProps(
  state: UseColumnHeaderFilterStateResult,
  classNames?: DateFilterClassNames
): DateFilterContentProps {
  return {
    tempDateFrom: state.tempDateFrom,
    setTempDateFrom: state.setTempDateFrom,
    tempDateTo: state.tempDateTo,
    setTempDateTo: state.setTempDateTo,
    onApply: state.handlers.handleDateApply,
    onClear: state.handlers.handleDateClear,
    classNames,
  };
}
