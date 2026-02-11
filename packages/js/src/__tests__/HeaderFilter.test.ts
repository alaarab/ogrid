import { OGrid } from '../OGrid';
import { HeaderFilterState } from '../state/HeaderFilterState';
import type { HeaderFilterConfig } from '../state/HeaderFilterState';
import type { IColumnDef, OGridOptions } from '../types';

interface TestRow {
  id: number;
  name: string;
  age: number;
  department: string;
}

const filterableColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
  { columnId: 'age', name: 'Age', type: 'numeric', sortable: true },
  { columnId: 'department', name: 'Department', filterable: { type: 'multiSelect' } },
];

const testData: TestRow[] = [
  { id: 1, name: 'Alice', age: 30, department: 'Engineering' },
  { id: 2, name: 'Bob', age: 25, department: 'Marketing' },
  { id: 3, name: 'Charlie', age: 35, department: 'Engineering' },
  { id: 4, name: 'Dave', age: 28, department: 'Sales' },
  { id: 5, name: 'Eve', age: 32, department: 'Marketing' },
];

function createGrid(options?: Partial<OGridOptions<TestRow>>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const grid = new OGrid<TestRow>(container, {
    columns: filterableColumns,
    data: testData,
    getRowId: (item: TestRow) => item.id,
    pageSize: 20,
    cellSelection: false,
    ...options,
  });
  return { container, grid };
}

afterEach(() => {
  document.body.innerHTML = '';
  // Clean up any popovers that may have been appended to body
  document.querySelectorAll('.ogrid-header-filter-popover').forEach((el) => el.remove());
});

// ============================================================
// HeaderFilterState Unit Tests
// ============================================================

describe('HeaderFilterState', () => {
  const nameConfig: HeaderFilterConfig = { columnId: 'name', filterField: 'name', filterType: 'text' };
  const deptConfig: HeaderFilterConfig = { columnId: 'department', filterField: 'department', filterType: 'multiSelect' };

  it('initializes with no open column', () => {
    const onFilterChange = jest.fn();
    const state = new HeaderFilterState(onFilterChange);

    expect(state.openColumnId).toBeNull();
    expect(state.popoverPosition).toBeNull();
    expect(state.tempTextValue).toBe('');
    expect(state.tempSelected.size).toBe(0);

    state.destroy();
  });

  it('open sets openColumnId and popoverPosition', () => {
    const onFilterChange = jest.fn();
    const state = new HeaderFilterState(onFilterChange);

    const headerEl = document.createElement('th');
    // Mock getBoundingClientRect
    headerEl.getBoundingClientRect = jest.fn(() => ({
      bottom: 40,
      left: 100,
      top: 0,
      right: 200,
      width: 100,
      height: 40,
      x: 100,
      y: 0,
      toJSON: () => {},
    }));

    const popoverEl = document.createElement('div');
    state.open('name', nameConfig, headerEl, popoverEl);

    expect(state.openColumnId).toBe('name');
    expect(state.popoverPosition).toEqual({ top: 44, left: 100 });

    state.destroy();
  });

  it('close resets state', () => {
    const onFilterChange = jest.fn();
    const state = new HeaderFilterState(onFilterChange);

    const headerEl = document.createElement('th');
    headerEl.getBoundingClientRect = jest.fn(() => ({
      bottom: 40, left: 100, top: 0, right: 200, width: 100, height: 40, x: 100, y: 0, toJSON: () => {},
    }));

    state.open('name', nameConfig, headerEl, document.createElement('div'));
    state.close();

    expect(state.openColumnId).toBeNull();
    expect(state.popoverPosition).toBeNull();

    state.destroy();
  });

  it('applyTextFilter calls onFilterChange and closes', () => {
    const onFilterChange = jest.fn();
    const state = new HeaderFilterState(onFilterChange);

    state.setTempTextValue('Alice');
    state.applyTextFilter('name');

    expect(onFilterChange).toHaveBeenCalledWith('name', { type: 'text', value: 'Alice' });
    expect(state.openColumnId).toBeNull();

    state.destroy();
  });

  it('applyTextFilter with empty value clears filter', () => {
    const onFilterChange = jest.fn();
    const state = new HeaderFilterState(onFilterChange);

    state.setTempTextValue('');
    state.applyTextFilter('name');

    expect(onFilterChange).toHaveBeenCalledWith('name', undefined);

    state.destroy();
  });

  it('applyTextFilter trims whitespace', () => {
    const onFilterChange = jest.fn();
    const state = new HeaderFilterState(onFilterChange);

    state.setTempTextValue('   ');
    state.applyTextFilter('name');

    expect(onFilterChange).toHaveBeenCalledWith('name', undefined);

    state.destroy();
  });

  it('clearTextFilter resets tempTextValue and calls onFilterChange', () => {
    const onFilterChange = jest.fn();
    const state = new HeaderFilterState(onFilterChange);

    state.setTempTextValue('Alice');
    state.clearTextFilter('name');

    expect(state.tempTextValue).toBe('');
    expect(onFilterChange).toHaveBeenCalledWith('name', undefined);

    state.destroy();
  });

  it('handleCheckboxChange adds and removes from tempSelected', () => {
    const state = new HeaderFilterState(jest.fn());

    state.handleCheckboxChange('Engineering', true);
    expect(state.tempSelected.has('Engineering')).toBe(true);

    state.handleCheckboxChange('Marketing', true);
    expect(state.tempSelected.size).toBe(2);

    state.handleCheckboxChange('Engineering', false);
    expect(state.tempSelected.has('Engineering')).toBe(false);
    expect(state.tempSelected.size).toBe(1);

    state.destroy();
  });

  it('handleSelectAll selects all filter options', () => {
    const state = new HeaderFilterState(jest.fn());
    state.setFilterOptions({ department: ['Engineering', 'Marketing', 'Sales'] });

    state.handleSelectAll('department');
    expect(state.tempSelected.size).toBe(3);
    expect(state.tempSelected.has('Engineering')).toBe(true);
    expect(state.tempSelected.has('Marketing')).toBe(true);
    expect(state.tempSelected.has('Sales')).toBe(true);

    state.destroy();
  });

  it('handleClearSelection clears all selections', () => {
    const state = new HeaderFilterState(jest.fn());

    state.handleCheckboxChange('Engineering', true);
    state.handleCheckboxChange('Marketing', true);
    state.handleClearSelection();

    expect(state.tempSelected.size).toBe(0);

    state.destroy();
  });

  it('applyMultiSelectFilter applies selected values', () => {
    const onFilterChange = jest.fn();
    const state = new HeaderFilterState(onFilterChange);

    state.handleCheckboxChange('Engineering', true);
    state.handleCheckboxChange('Sales', true);
    state.applyMultiSelectFilter('department');

    expect(onFilterChange).toHaveBeenCalledWith(
      'department',
      { type: 'multiSelect', value: expect.arrayContaining(['Engineering', 'Sales']) }
    );

    state.destroy();
  });

  it('applyMultiSelectFilter with empty selection clears filter', () => {
    const onFilterChange = jest.fn();
    const state = new HeaderFilterState(onFilterChange);

    state.applyMultiSelectFilter('department');

    expect(onFilterChange).toHaveBeenCalledWith('department', undefined);

    state.destroy();
  });

  it('applyDateFilter applies date range', () => {
    const onFilterChange = jest.fn();
    const state = new HeaderFilterState(onFilterChange);

    state.setTempDateFrom('2025-01-01');
    state.setTempDateTo('2025-12-31');
    state.applyDateFilter('created');

    expect(onFilterChange).toHaveBeenCalledWith('created', {
      type: 'date',
      value: { from: '2025-01-01', to: '2025-12-31' },
    });

    state.destroy();
  });

  it('applyDateFilter with empty dates clears filter', () => {
    const onFilterChange = jest.fn();
    const state = new HeaderFilterState(onFilterChange);

    state.setTempDateFrom('');
    state.setTempDateTo('');
    state.applyDateFilter('created');

    expect(onFilterChange).toHaveBeenCalledWith('created', undefined);

    state.destroy();
  });

  it('clearDateFilter resets dates and clears filter', () => {
    const onFilterChange = jest.fn();
    const state = new HeaderFilterState(onFilterChange);

    state.setTempDateFrom('2025-01-01');
    state.setTempDateTo('2025-12-31');
    state.clearDateFilter('created');

    expect(state.tempDateFrom).toBe('');
    expect(state.tempDateTo).toBe('');
    expect(onFilterChange).toHaveBeenCalledWith('created', undefined);

    state.destroy();
  });

  it('emits change events', () => {
    const state = new HeaderFilterState(jest.fn());
    const handler = jest.fn();
    state.onChange(handler);

    state.setTempTextValue('test');
    expect(handler).toHaveBeenCalledTimes(1);

    state.setSearchText('search');
    expect(handler).toHaveBeenCalledTimes(2);

    state.handleCheckboxChange('opt', true);
    expect(handler).toHaveBeenCalledTimes(3);

    state.destroy();
  });

  it('getFilteredOptions filters by search text', () => {
    const state = new HeaderFilterState(jest.fn());
    state.setFilterOptions({ department: ['Engineering', 'Marketing', 'Sales'] });

    expect(state.getFilteredOptions('department')).toEqual(['Engineering', 'Marketing', 'Sales']);

    state.setSearchText('eng');
    expect(state.getFilteredOptions('department')).toEqual(['Engineering']);

    state.setSearchText('ING');
    expect(state.getFilteredOptions('department')).toEqual(['Engineering', 'Marketing']);

    state.destroy();
  });

  it('hasActiveFilter detects active text filter', () => {
    const state = new HeaderFilterState(jest.fn());
    state.setFilters({ name: { type: 'text', value: 'Alice' } });

    expect(state.hasActiveFilter(nameConfig)).toBe(true);

    state.setFilters({ name: { type: 'text', value: '' } });
    expect(state.hasActiveFilter(nameConfig)).toBe(false);

    state.destroy();
  });

  it('hasActiveFilter detects active multiSelect filter', () => {
    const state = new HeaderFilterState(jest.fn());
    state.setFilters({ department: { type: 'multiSelect', value: ['Engineering'] } });

    expect(state.hasActiveFilter(deptConfig)).toBe(true);

    state.setFilters({ department: { type: 'multiSelect', value: [] } });
    expect(state.hasActiveFilter(deptConfig)).toBe(false);

    state.destroy();
  });

  it('hasActiveFilter returns false when no filter set', () => {
    const state = new HeaderFilterState(jest.fn());
    state.setFilters({});

    expect(state.hasActiveFilter(nameConfig)).toBe(false);

    state.destroy();
  });

  it('open initializes tempTextValue from existing filter', () => {
    const state = new HeaderFilterState(jest.fn());
    state.setFilters({ name: { type: 'text', value: 'existing' } });

    const headerEl = document.createElement('th');
    headerEl.getBoundingClientRect = jest.fn(() => ({
      bottom: 40, left: 0, top: 0, right: 100, width: 100, height: 40, x: 0, y: 0, toJSON: () => {},
    }));

    state.open('name', nameConfig, headerEl, document.createElement('div'));
    expect(state.tempTextValue).toBe('existing');

    state.destroy();
  });

  it('open initializes tempSelected from existing multiSelect filter', () => {
    const state = new HeaderFilterState(jest.fn());
    state.setFilters({ department: { type: 'multiSelect', value: ['Engineering', 'Sales'] } });

    const headerEl = document.createElement('th');
    headerEl.getBoundingClientRect = jest.fn(() => ({
      bottom: 40, left: 0, top: 0, right: 100, width: 100, height: 40, x: 0, y: 0, toJSON: () => {},
    }));

    state.open('department', deptConfig, headerEl, document.createElement('div'));
    expect(state.tempSelected).toEqual(new Set(['Engineering', 'Sales']));

    state.destroy();
  });
});

// ============================================================
// OGrid Header Filter Integration Tests
// ============================================================

describe('OGrid Header Filters', () => {
  it('renders filter icons on filterable columns', () => {
    const { container, grid } = createGrid();

    const filterIcons = container.querySelectorAll('.ogrid-filter-icon');
    expect(filterIcons.length).toBe(2); // name (text) + department (multiSelect)

    grid.destroy();
  });

  it('does not render filter icon on non-filterable columns', () => {
    const { container, grid } = createGrid();

    // The "age" column has no filterable config
    const ageHeader = container.querySelector('th[data-column-id="age"]');
    expect(ageHeader).not.toBeNull();
    const filterIcon = ageHeader!.querySelector('.ogrid-filter-icon');
    expect(filterIcon).toBeNull();

    grid.destroy();
  });

  it('filter icons have proper aria labels', () => {
    const { container, grid } = createGrid();

    const nameFilter = container.querySelector('th[data-column-id="name"] .ogrid-filter-icon');
    expect(nameFilter).not.toBeNull();
    expect(nameFilter!.getAttribute('aria-label')).toBe('Filter Name');

    const deptFilter = container.querySelector('th[data-column-id="department"] .ogrid-filter-icon');
    expect(deptFilter).not.toBeNull();
    expect(deptFilter!.getAttribute('aria-label')).toBe('Filter Department');

    grid.destroy();
  });

  it('clicking filter icon opens popover', () => {
    const { container, grid } = createGrid();

    const filterIcon = container.querySelector('th[data-column-id="name"] .ogrid-filter-icon') as HTMLButtonElement;
    filterIcon.click();

    const popover = document.querySelector('.ogrid-header-filter-popover');
    expect(popover).not.toBeNull();

    grid.destroy();
  });

  it('text filter popover has input, Apply, and Clear buttons', () => {
    const { container, grid } = createGrid();

    const filterIcon = container.querySelector('th[data-column-id="name"] .ogrid-filter-icon') as HTMLButtonElement;
    filterIcon.click();

    const popover = document.querySelector('.ogrid-header-filter-popover');
    expect(popover).not.toBeNull();

    const input = popover!.querySelector('.ogrid-filter-text-input');
    expect(input).not.toBeNull();

    const applyBtn = popover!.querySelector('.ogrid-filter-apply-btn');
    expect(applyBtn).not.toBeNull();
    expect(applyBtn!.textContent).toBe('Apply');

    const clearBtn = popover!.querySelector('.ogrid-filter-clear-btn');
    expect(clearBtn).not.toBeNull();
    expect(clearBtn!.textContent).toBe('Clear');

    grid.destroy();
  });

  it('clicking filter icon again closes popover', () => {
    const { container, grid } = createGrid();

    const filterIcon = container.querySelector('th[data-column-id="name"] .ogrid-filter-icon') as HTMLButtonElement;
    filterIcon.click();

    expect(document.querySelector('.ogrid-header-filter-popover')).not.toBeNull();

    filterIcon.click();

    expect(document.querySelector('.ogrid-header-filter-popover')).toBeNull();

    grid.destroy();
  });

  it('multiSelect popover has search, Select All, Clear, checkboxes, and Apply', () => {
    const { container, grid } = createGrid();

    const filterIcon = container.querySelector('th[data-column-id="department"] .ogrid-filter-icon') as HTMLButtonElement;
    filterIcon.click();

    const popover = document.querySelector('.ogrid-header-filter-popover');
    expect(popover).not.toBeNull();

    const searchInput = popover!.querySelector('.ogrid-filter-search-input');
    expect(searchInput).not.toBeNull();

    const selectAllBtn = popover!.querySelector('.ogrid-filter-select-all-btn');
    expect(selectAllBtn).not.toBeNull();
    expect(selectAllBtn!.textContent).toBe('Select All');

    const clearSelBtn = popover!.querySelector('.ogrid-filter-clear-sel-btn');
    expect(clearSelBtn).not.toBeNull();

    const checkboxList = popover!.querySelector('.ogrid-filter-checkbox-list');
    expect(checkboxList).not.toBeNull();

    const applyBtn = popover!.querySelector('.ogrid-filter-apply-btn');
    expect(applyBtn).not.toBeNull();

    grid.destroy();
  });

  it('multiSelect popover shows filter options derived from data', () => {
    const { container, grid } = createGrid();

    const filterIcon = container.querySelector('th[data-column-id="department"] .ogrid-filter-icon') as HTMLButtonElement;
    filterIcon.click();

    const popover = document.querySelector('.ogrid-header-filter-popover');
    const checkboxList = popover!.querySelector('.ogrid-filter-checkbox-list');
    const labels = checkboxList!.querySelectorAll('label span');
    const optionTexts = Array.from(labels).map((l) => l.textContent);

    expect(optionTexts).toContain('Engineering');
    expect(optionTexts).toContain('Marketing');
    expect(optionTexts).toContain('Sales');

    grid.destroy();
  });

  it('filter icon shows active indicator when filter is applied', () => {
    const { container, grid } = createGrid({
      filters: { name: { type: 'text', value: 'Alice' } },
    });

    const filterIcon = container.querySelector('th[data-column-id="name"] .ogrid-filter-icon') as HTMLElement;
    // Active filter: filled triangle (▼) and opacity=1
    expect(filterIcon.textContent).toBe('\u25BC');
    expect(filterIcon.style.opacity).toBe('1');

    grid.destroy();
  });

  it('filter icon shows inactive indicator when no filter applied', () => {
    const { container, grid } = createGrid();

    const filterIcon = container.querySelector('th[data-column-id="name"] .ogrid-filter-icon') as HTMLElement;
    // Inactive: empty triangle (▽)
    expect(filterIcon.textContent).toBe('\u25BD');

    grid.destroy();
  });
});
