/**
 * Shared ColumnHeaderFilter tests for Vue.
 * Each Vue UI package calls createColumnHeaderFilterTests() to run these.
 * Tests the useColumnHeaderFilterState composable directly.
 */
import { useColumnHeaderFilterState } from '../composables/useColumnHeaderFilterState';

export function createColumnHeaderFilterTests(): void {
  it('initializes with filter closed', () => {
    const state = useColumnHeaderFilterState({
      filterType: 'text',
      textValue: '',
      onTextChange: jest.fn(),
    });
    expect(state.isFilterOpen.value).toBe(false);
    expect(state.hasActiveFilter.value).toBe(false);
  });

  it('text filter tracks temp value and applies', () => {
    const onTextChange = jest.fn();
    const state = useColumnHeaderFilterState({
      filterType: 'text',
      textValue: '',
      onTextChange,
    });

    state.setFilterOpen(true);
    state.setTempTextValue('Alpha');
    expect(state.tempTextValue.value).toBe('Alpha');

    state.handlers.handleTextApply();
    expect(onTextChange).toHaveBeenCalledWith('Alpha');
    expect(state.isFilterOpen.value).toBe(false);
  });

  it('text filter clear resets temp value (apply to submit)', () => {
    const onTextChange = jest.fn();
    const state = useColumnHeaderFilterState({
      filterType: 'text',
      textValue: 'existing',
      onTextChange,
    });

    state.setFilterOpen(true);
    // Clear resets the temp value
    state.handlers.handleTextClear();
    expect(state.tempTextValue.value).toBe('');
    // Apply submits the cleared value
    state.handlers.handleTextApply();
    expect(onTextChange).toHaveBeenCalledWith('');
  });

  it('multiSelect filter tracks temp selected and applies', () => {
    const onFilterChange = jest.fn();
    const state = useColumnHeaderFilterState({
      filterType: 'multiSelect',
      selectedValues: [],
      onFilterChange,
      options: ['Active', 'Closed'],
    });

    state.setFilterOpen(true);

    // Select all
    state.handlers.handleSelectAll();
    expect(state.tempSelected.value.size).toBe(2);

    // Apply
    state.handlers.handleApplyMultiSelect();
    expect(onFilterChange).toHaveBeenCalledWith(['Active', 'Closed']);
    expect(state.isFilterOpen.value).toBe(false);
  });

  it('multiSelect clear resets selection', () => {
    const onFilterChange = jest.fn();
    const state = useColumnHeaderFilterState({
      filterType: 'multiSelect',
      selectedValues: ['Active'],
      onFilterChange,
      options: ['Active', 'Closed'],
    });

    state.setFilterOpen(true);
    state.handlers.handleClearSelection();
    expect(state.tempSelected.value.size).toBe(0);

    state.handlers.handleApplyMultiSelect();
    expect(onFilterChange).toHaveBeenCalledWith([]);
  });

  it('hasActiveFilter reflects text filter state', () => {
    const state = useColumnHeaderFilterState({
      filterType: 'text',
      textValue: 'something',
      onTextChange: jest.fn(),
    });
    expect(state.hasActiveFilter.value).toBe(true);
  });

  it('hasActiveFilter reflects multiSelect state', () => {
    const state = useColumnHeaderFilterState({
      filterType: 'multiSelect',
      selectedValues: ['Active'],
      onFilterChange: jest.fn(),
      options: ['Active', 'Closed'],
    });
    expect(state.hasActiveFilter.value).toBe(true);
  });

  it('date filter tracks from/to and applies', () => {
    const onDateChange = jest.fn();
    const state = useColumnHeaderFilterState({
      filterType: 'date',
      dateValue: undefined,
      onDateChange,
    });

    state.setFilterOpen(true);
    state.setTempDateFrom('2024-01-01');
    state.setTempDateTo('2024-12-31');
    expect(state.tempDateFrom.value).toBe('2024-01-01');
    expect(state.tempDateTo.value).toBe('2024-12-31');

    state.handlers.handleDateApply();
    expect(onDateChange).toHaveBeenCalledWith({ from: '2024-01-01', to: '2024-12-31' });
    expect(state.isFilterOpen.value).toBe(false);
  });

  it('aria-expanded: isFilterOpen is false initially (aria-expanded=false)', () => {
    const state = useColumnHeaderFilterState({
      filterType: 'text',
      textValue: '',
      onTextChange: jest.fn(),
    });
    // isFilterOpen drives aria-expanded on the filter button
    expect(state.isFilterOpen.value).toBe(false);
  });

  it('aria-expanded: isFilterOpen becomes true when filter is opened', () => {
    const state = useColumnHeaderFilterState({
      filterType: 'text',
      textValue: '',
      onTextChange: jest.fn(),
    });
    state.setFilterOpen(true);
    expect(state.isFilterOpen.value).toBe(true);
  });

  it('aria-expanded: isFilterOpen returns to false after filter is closed', () => {
    const state = useColumnHeaderFilterState({
      filterType: 'multiSelect',
      selectedValues: [],
      onFilterChange: jest.fn(),
      options: ['Active', 'Closed'],
    });
    state.setFilterOpen(true);
    expect(state.isFilterOpen.value).toBe(true);

    state.setFilterOpen(false);
    expect(state.isFilterOpen.value).toBe(false);
  });

  it('aria-expanded: applying filter closes popover (aria-expanded returns to false)', () => {
    const state = useColumnHeaderFilterState({
      filterType: 'text',
      textValue: '',
      onTextChange: jest.fn(),
    });
    state.setFilterOpen(true);
    expect(state.isFilterOpen.value).toBe(true);

    state.handlers.handleTextApply();
    expect(state.isFilterOpen.value).toBe(false);
  });
}
