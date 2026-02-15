/**
 * Shared ColumnHeaderFilter tests for Angular UI packages.
 * Each UI package calls createColumnHeaderFilterTests(ColumnHeaderFilterComponent) to run these.
 *
 * Tests instantiate the component class directly and verify behavior.
 * Inputs use @Input() decorators (plain properties), internal state uses signals.
 */

import type { ColumnFilterType, IDateFilterValue, UserLike } from '@alaarab/ogrid-core';

import type { Signal, WritableSignal } from '@angular/core';

interface ColumnHeaderFilterInstance {
  // @Input() properties
  columnKey?: string;
  columnName?: string;
  filterType?: ColumnFilterType;
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
  // Internal signal state (writable)
  isFilterOpen: WritableSignal<boolean>;
  tempTextValue: WritableSignal<string>;
  tempSelected: WritableSignal<Set<string>>;
  tempDateFrom: WritableSignal<string>;
  tempDateTo: WritableSignal<string>;
  searchText: WritableSignal<string>;
  // Computed signals (read-only)
  hasActiveFilter: Signal<boolean>;
  filteredOptions: Signal<string[]>;
  // Handler methods (canonical names)
  handleTextApply: () => void;
  handleTextClear: () => void;
  handleApplyMultiSelect?: () => void;
  handleMultiSelectApply?: () => void;
  handleClearSelection: () => void;
  handleSelectAllFiltered?: () => void;
  handleSelectAllOptions?: () => void;
  handleDateApply: () => void;
  handleDateClear: () => void;
}

export function createColumnHeaderFilterTests(ColumnHeaderFilterComponent: new () => ColumnHeaderFilterInstance): void {
  function createComponent(overrides: Partial<ColumnHeaderFilterInstance> = {}): ColumnHeaderFilterInstance {
    const instance = new ColumnHeaderFilterComponent();
    // Set @Input() properties directly
    if (overrides.columnKey !== undefined) instance.columnKey = overrides.columnKey;
    if (overrides.columnName !== undefined) instance.columnName = overrides.columnName;
    if (overrides.filterType !== undefined) instance.filterType = overrides.filterType;
    if (overrides.isSorted !== undefined) instance.isSorted = overrides.isSorted;
    if (overrides.isSortedDescending !== undefined) instance.isSortedDescending = overrides.isSortedDescending;
    if (overrides.onSort !== undefined) instance.onSort = overrides.onSort;
    if (overrides.selectedValues !== undefined) instance.selectedValues = overrides.selectedValues;
    if (overrides.onFilterChange !== undefined) instance.onFilterChange = overrides.onFilterChange;
    if (overrides.options !== undefined) instance.options = overrides.options;
    if (overrides.isLoadingOptions !== undefined) instance.isLoadingOptions = overrides.isLoadingOptions;
    if (overrides.textValue !== undefined) instance.textValue = overrides.textValue;
    if (overrides.onTextChange !== undefined) instance.onTextChange = overrides.onTextChange;
    if (overrides.selectedUser !== undefined) instance.selectedUser = overrides.selectedUser;
    if (overrides.onUserChange !== undefined) instance.onUserChange = overrides.onUserChange;
    if (overrides.peopleSearch !== undefined) instance.peopleSearch = overrides.peopleSearch;
    if (overrides.dateValue !== undefined) instance.dateValue = overrides.dateValue;
    if (overrides.onDateChange !== undefined) instance.onDateChange = overrides.onDateChange;
    return instance;
  }

  it('instantiates with required inputs', () => {
    const comp = createComponent({ columnKey: 'name', columnName: 'Name', filterType: 'text' });
    expect(comp).toBeTruthy();
    expect(comp.columnKey).toBe('name');
    expect(comp.columnName).toBe('Name');
    expect(comp.filterType).toBe('text');
  });

  it('hasActiveFilter is false for text filter with no value', () => {
    const comp = createComponent({ columnKey: 'name', columnName: 'Name', filterType: 'text', textValue: '' });
    expect(comp.hasActiveFilter()).toBe(false);
  });

  it('hasActiveFilter is true for text filter with value', () => {
    const comp = createComponent({ columnKey: 'name', columnName: 'Name', filterType: 'text', textValue: 'Alpha' });
    expect(comp.hasActiveFilter()).toBe(true);
  });

  it('hasActiveFilter is true for multiSelect with selected values', () => {
    const comp = createComponent({ columnKey: 'status', columnName: 'Status', filterType: 'multiSelect', selectedValues: ['Active'] });
    expect(comp.hasActiveFilter()).toBe(true);
  });

  it('hasActiveFilter is false for multiSelect with empty values', () => {
    const comp = createComponent({ columnKey: 'status', columnName: 'Status', filterType: 'multiSelect', selectedValues: [] });
    expect(comp.hasActiveFilter()).toBe(false);
  });

  it('hasActiveFilter is false for "none" filter type', () => {
    const comp = createComponent({ columnKey: 'id', columnName: 'ID', filterType: 'none' });
    expect(comp.hasActiveFilter()).toBe(false);
  });

  it('filteredOptions filters by search text', () => {
    const comp = createComponent({ columnKey: 'status', columnName: 'Status', filterType: 'multiSelect', options: ['Active', 'Closed'] });
    expect(comp.filteredOptions()).toEqual(['Active', 'Closed']);
    comp.searchText.set('act');
    expect(comp.filteredOptions()).toEqual(['Active']);
  });

  it('isFilterOpen defaults to false', () => {
    const comp = createComponent({ columnKey: 'name', columnName: 'Name', filterType: 'text' });
    expect(comp.isFilterOpen()).toBe(false);
  });

  it('text filter apply calls onTextChange', () => {
    const onTextChange = jest.fn();
    const comp = createComponent({ columnKey: 'name', columnName: 'Name', filterType: 'text', textValue: '', onTextChange });
    comp.isFilterOpen.set(true);
    comp.tempTextValue.set('Alpha');
    comp.handleTextApply();
    expect(onTextChange).toHaveBeenCalledWith('Alpha');
    expect(comp.isFilterOpen()).toBe(false);
  });

  it('text filter clear calls onTextChange with empty string', () => {
    const onTextChange = jest.fn();
    const comp = createComponent({ columnKey: 'name', columnName: 'Name', filterType: 'text', textValue: 'X', onTextChange });
    comp.isFilterOpen.set(true);
    comp.tempTextValue.set('X');
    comp.handleTextClear();
    expect(onTextChange).toHaveBeenCalledWith('');
    expect(comp.tempTextValue()).toBe('');
    expect(comp.isFilterOpen()).toBe(false);
  });

  it('multiSelect apply calls onFilterChange with selected values', () => {
    const onFilterChange = jest.fn();
    const comp = createComponent({ columnKey: 'status', columnName: 'Status', filterType: 'multiSelect', options: ['Active', 'Closed'], onFilterChange });
    comp.isFilterOpen.set(true);
    comp.tempSelected.set(new Set(['Active', 'Closed']));
    // Support both `handleApplyMultiSelect()` (Material/PrimeNG) and `handleMultiSelectApply()` (Radix)
    if (typeof comp.handleApplyMultiSelect === 'function') {
      comp.handleApplyMultiSelect();
    } else {
      comp.handleMultiSelectApply!();
    }
    expect(onFilterChange).toHaveBeenCalledWith(['Active', 'Closed']);
    expect(comp.isFilterOpen()).toBe(false);
  });

  it('multiSelect clear resets temp selection', () => {
    const comp = createComponent({ columnKey: 'status', columnName: 'Status', filterType: 'multiSelect', options: ['Active', 'Closed'] });
    comp.tempSelected.set(new Set(['Active']));
    comp.handleClearSelection();
    expect(comp.tempSelected().size).toBe(0);
  });

  it('multiSelect select all filtered adds all filtered options', () => {
    const comp = createComponent({ columnKey: 'status', columnName: 'Status', filterType: 'multiSelect', options: ['Active', 'Closed'] });
    comp.tempSelected.set(new Set());
    // Support both `handleSelectAllFiltered()` (Material/Radix) and `handleSelectAllOptions()` (PrimeNG)
    if (typeof comp.handleSelectAllFiltered === 'function') {
      comp.handleSelectAllFiltered();
    } else {
      comp.handleSelectAllOptions!();
    }
    expect(comp.tempSelected()).toEqual(new Set(['Active', 'Closed']));
  });

  it('date filter apply calls onDateChange with from/to', () => {
    const onDateChange = jest.fn();
    const comp = createComponent({ columnKey: 'date', columnName: 'Date', filterType: 'date', onDateChange });
    comp.isFilterOpen.set(true);
    comp.tempDateFrom.set('2024-01-01');
    comp.tempDateTo.set('2024-12-31');
    comp.handleDateApply();
    expect(onDateChange).toHaveBeenCalledWith({ from: '2024-01-01', to: '2024-12-31' });
    expect(comp.isFilterOpen()).toBe(false);
  });

  it('date filter clear calls onDateChange and resets state', () => {
    const onDateChange = jest.fn();
    const comp = createComponent({ columnKey: 'date', columnName: 'Date', filterType: 'date', onDateChange });
    comp.isFilterOpen.set(true);
    comp.tempDateFrom.set('2024-01-01');
    comp.tempDateTo.set('2024-12-31');
    comp.handleDateClear();
    // Some packages call onDateChange(undefined), others call onDateChange({ from: '', to: '' })
    expect(onDateChange).toHaveBeenCalled();
    expect(comp.tempDateFrom()).toBe('');
    expect(comp.tempDateTo()).toBe('');
    expect(comp.isFilterOpen()).toBe(false);
  });

  it('people filter hasActiveFilter is true when selectedUser is set', () => {
    const comp = createComponent({ columnKey: 'owner', columnName: 'Owner', filterType: 'people', selectedUser: { id: '1', displayName: 'Alice', email: 'a@b.com' } });
    expect(comp.hasActiveFilter()).toBe(true);
  });

  it('people filter hasActiveFilter is false when no user selected', () => {
    const comp = createComponent({ columnKey: 'owner', columnName: 'Owner', filterType: 'people' });
    expect(comp.hasActiveFilter()).toBe(false);
  });
}
