import type { FilterOption } from '@alaarab/ogrid-core';
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
import type { ConditionDraft } from '../hooks/useConditionFilterState';
import { CONDITION_OPERATORS, getConditionOperatorArity, getConditionOperatorLabel } from '@alaarab/ogrid-core';
import type { ConditionFilterKind, ConditionOperator, IConditionFilterValue } from '@alaarab/ogrid-core';

// ---- Shared Props ----

export interface IColumnHeaderFilterProps {
  columnKey: string;
  columnName: string;
  filterType: ColumnFilterType;
  isSorted?: boolean;
  isSortedDescending?: boolean;
  /** 1-based sort priority, shown next to the sort arrow when the grid sorts by several columns. */
  sortIndex?: number;
  /** Toggle the sort; `{ additive: true }` (Shift+click) adds or cycles a sort level. */
  onSort?: (options?: { additive?: boolean }) => void;
  selectedValues?: string[];
  onFilterChange?: (values: string[]) => void;
  options?: FilterOption[];
  isLoadingOptions?: boolean;
  textValue?: string;
  onTextChange?: (value: string) => void;
  selectedUser?: UserLike;
  onUserChange?: (user: UserLike | undefined) => void;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
  dateValue?: IDateFilterValue;
  onDateChange?: (value: IDateFilterValue | undefined) => void;
  /** Operator set for `number` / `condition` filters. */
  conditionKind?: ConditionFilterKind;
  conditionValue?: IConditionFilterValue;
  onConditionChange?: (value: IConditionFilterValue | undefined) => void;
}

// ---- Condition Filter Content ----

const conditionContainerStyle: React.CSSProperties = { padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 };
const conditionRowStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const conditionOperandsStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 };
const conditionInputStyle: React.CSSProperties = { flex: 1, minWidth: 0 };
const conditionJoinStyle: React.CSSProperties = { display: 'flex', gap: 12, fontSize: 12 };
const conditionJoinLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4 };

export interface ConditionFilterClassNames {
  popoverActions?: string;
  clearButton?: string;
  applyButton?: string;
  /** Class for the operator selects. */
  select?: string;
  /** Class for the operand inputs. */
  input?: string;
}

export interface ConditionFilterContentProps {
  kind: ConditionFilterKind;
  drafts: [ConditionDraft, ConditionDraft];
  onDraftChange: (index: 0 | 1, patch: Partial<ConditionDraft>) => void;
  join: 'and' | 'or';
  onJoinChange: (join: 'and' | 'or') => void;
  onApply: () => void;
  onClear: () => void;
  /** Used for accessible names ("Price condition 1"). */
  columnName?: string;
  classNames?: ConditionFilterClassNames;
}

function operandInputType(kind: ConditionFilterKind, operator: ConditionOperator | ''): string {
  if (operator === 'top' || operator === 'bottom' || kind === 'number') return 'number';
  return kind === 'date' ? 'date' : 'text';
}

let conditionGroupCounter = 0;

/**
 * Excel-style custom AutoFilter: an operator and operand(s) for up to two
 * conditions joined with And / Or. Shared by the kits' filter popovers.
 */
export const ConditionFilterContent: React.FC<ConditionFilterContentProps> = ({
  kind,
  drafts,
  onDraftChange,
  join,
  onJoinChange,
  onApply,
  onClear,
  columnName,
  classNames,
}) => {
  // React 17 has no useId; a per-instance counter keeps radio groups apart.
  const [groupId] = React.useState(() => `ogrid-condition-join-${++conditionGroupCounter}`);
  const operators = CONDITION_OPERATORS[kind];
  const prefix = columnName ? `${columnName} condition` : 'Condition';
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onApply();
    }
  };

  const renderRow = (index: 0 | 1) => {
    const draft = drafts[index];
    const arity = draft.operator ? getConditionOperatorArity(draft.operator) : 0;
    const type = operandInputType(kind, draft.operator);
    const isCount = draft.operator === 'top' || draft.operator === 'bottom';
    return (
      <div style={conditionRowStyle} data-ogrid-condition={index + 1}>
        <select
          className={classNames?.select}
          aria-label={`${prefix} ${index + 1}`}
          value={draft.operator}
          onChange={(e) => onDraftChange(index, { operator: e.target.value as ConditionOperator | '' })}
        >
          {index === 1 && <option value="">(none)</option>}
          {operators.map((op) => (
            <option key={op} value={op}>
              {getConditionOperatorLabel(op, kind)}
            </option>
          ))}
        </select>
        {arity > 0 && (
          <div style={conditionOperandsStyle}>
            <input
              type={type}
              className={classNames?.input}
              style={conditionInputStyle}
              aria-label={arity === 2 ? `${prefix} ${index + 1} from` : `${prefix} ${index + 1} value`}
              placeholder={isCount ? 'N' : 'Value'}
              min={isCount ? 1 : undefined}
              value={draft.value}
              onChange={(e) => onDraftChange(index, { value: e.target.value })}
              onKeyDown={onKeyDown}
              autoComplete="off"
            />
            {arity === 2 && (
              <>
                <span>and</span>
                <input
                  type={type}
                  className={classNames?.input}
                  style={conditionInputStyle}
                  aria-label={`${prefix} ${index + 1} to`}
                  placeholder="Value"
                  value={draft.valueTo}
                  onChange={(e) => onDraftChange(index, { valueTo: e.target.value })}
                  onKeyDown={onKeyDown}
                  autoComplete="off"
                />
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div style={conditionContainerStyle}>
        {renderRow(0)}
        <div data-ogrid-condition-join="" style={conditionJoinStyle} role="radiogroup" aria-label={`${prefix} join`}>
          <label style={conditionJoinLabelStyle}>
            <input type="radio" name={groupId} checked={join === 'and'} onChange={() => onJoinChange('and')} />
            And
          </label>
          <label style={conditionJoinLabelStyle}>
            <input type="radio" name={groupId} checked={join === 'or'} onChange={() => onJoinChange('or')} />
            Or
          </label>
        </div>
        {renderRow(1)}
      </div>
      <div className={classNames?.popoverActions}>
        <button type="button" className={classNames?.clearButton} onClick={onClear}>Clear</button>
        <button type="button" className={classNames?.applyButton} onClick={onApply}>Apply</button>
      </div>
    </>
  );
};

ConditionFilterContent.displayName = 'ConditionFilterContent';

/** Props for ConditionFilterContent from the shared header filter state. */
export function getConditionFilterContentProps(
  state: UseColumnHeaderFilterStateResult,
  classNames?: ConditionFilterClassNames,
  columnName?: string,
): ConditionFilterContentProps {
  return {
    kind: state.conditionKind,
    drafts: state.conditionDrafts,
    onDraftChange: state.setConditionDraft,
    join: state.conditionJoin,
    onJoinChange: state.setConditionJoin,
    onApply: state.handlers.handleConditionApply,
    onClear: state.handlers.handleConditionClear,
    columnName,
    classNames,
  };
}

// ---- Date Filter Content ----

const dateContainerStyle: React.CSSProperties = { padding: '16px', display: 'flex', flexDirection: 'column', gap: 6 };
const dateLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 };
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
      <button type="button" className={classNames?.clearButton} onClick={onClear} disabled={!tempDateFrom && !tempDateTo}>Clear</button>
      <button type="button" className={classNames?.applyButton} onClick={onApply}>Apply</button>
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
    conditionKind: props.conditionKind,
    conditionValue: props.conditionValue,
    onConditionChange: props.onConditionChange,
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
