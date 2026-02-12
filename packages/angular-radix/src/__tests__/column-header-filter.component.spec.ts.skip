import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ColumnHeaderFilterComponent } from '../column-header-filter/column-header-filter.component';

describe('ColumnHeaderFilterComponent', () => {
  let component: ColumnHeaderFilterComponent;
  let fixture: ComponentFixture<ColumnHeaderFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ColumnHeaderFilterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ColumnHeaderFilterComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render column name', () => {
    fixture.componentRef.setInput('columnKey', 'name');
    fixture.componentRef.setInput('columnName', 'Full Name');
    fixture.componentRef.setInput('filterType', 'none');
    fixture.detectChanges();

    const headerLabel = fixture.debugElement.query(By.css('[data-header-label]'));
    expect(headerLabel.nativeElement.textContent.trim()).toBe('Full Name');
  });

  describe('Sort button', () => {
    it('should show sort button when onSort provided', () => {
      fixture.componentRef.setInput('columnKey', 'name');
      fixture.componentRef.setInput('columnName', 'Name');
      fixture.componentRef.setInput('filterType', 'none');
      fixture.componentRef.setInput('onSort', jest.fn());
      fixture.detectChanges();

      const sortButton = fixture.debugElement.query(
        By.css('button[aria-label="Sort by Name"]')
      );
      expect(sortButton).toBeTruthy();
    });

    it('should not show sort button when onSort not provided', () => {
      fixture.componentRef.setInput('columnKey', 'name');
      fixture.componentRef.setInput('columnName', 'Name');
      fixture.componentRef.setInput('filterType', 'none');
      fixture.detectChanges();

      const sortButton = fixture.debugElement.query(
        By.css('button[aria-label="Sort by Name"]')
      );
      expect(sortButton).toBeNull();
    });

    it('should call onSort when sort button clicked', () => {
      const onSortMock = jest.fn();
      fixture.componentRef.setInput('columnKey', 'name');
      fixture.componentRef.setInput('columnName', 'Name');
      fixture.componentRef.setInput('filterType', 'none');
      fixture.componentRef.setInput('onSort', onSortMock);
      fixture.detectChanges();

      const sortButton = fixture.debugElement.query(
        By.css('button[aria-label="Sort by Name"]')
      );
      sortButton.nativeElement.click();

      expect(onSortMock).toHaveBeenCalled();
    });

    it('should show ascending indicator when sorted ascending', () => {
      fixture.componentRef.setInput('columnKey', 'name');
      fixture.componentRef.setInput('columnName', 'Name');
      fixture.componentRef.setInput('filterType', 'none');
      fixture.componentRef.setInput('onSort', jest.fn());
      fixture.componentRef.setInput('isSorted', true);
      fixture.componentRef.setInput('isSortedDescending', false);
      fixture.detectChanges();

      const sortButton = fixture.debugElement.query(
        By.css('button[aria-label="Sort by Name"]')
      );
      expect(sortButton.nativeElement.textContent.trim()).toBe('▲');
    });

    it('should show descending indicator when sorted descending', () => {
      fixture.componentRef.setInput('columnKey', 'name');
      fixture.componentRef.setInput('columnName', 'Name');
      fixture.componentRef.setInput('filterType', 'none');
      fixture.componentRef.setInput('onSort', jest.fn());
      fixture.componentRef.setInput('isSorted', true);
      fixture.componentRef.setInput('isSortedDescending', true);
      fixture.detectChanges();

      const sortButton = fixture.debugElement.query(
        By.css('button[aria-label="Sort by Name"]')
      );
      expect(sortButton.nativeElement.textContent.trim()).toBe('▼');
    });
  });

  describe('Filter button', () => {
    it('should show filter button when filterType is not none', () => {
      fixture.componentRef.setInput('columnKey', 'name');
      fixture.componentRef.setInput('columnName', 'Name');
      fixture.componentRef.setInput('filterType', 'text');
      fixture.detectChanges();

      const filterButton = fixture.debugElement.query(
        By.css('button[aria-label="Filter Name"]')
      );
      expect(filterButton).toBeTruthy();
    });

    it('should not show filter button when filterType is none', () => {
      fixture.componentRef.setInput('columnKey', 'name');
      fixture.componentRef.setInput('columnName', 'Name');
      fixture.componentRef.setInput('filterType', 'none');
      fixture.detectChanges();

      const filterButton = fixture.debugElement.query(
        By.css('button[aria-label="Filter Name"]')
      );
      expect(filterButton).toBeNull();
    });

    it('should toggle popover when filter button clicked', () => {
      fixture.componentRef.setInput('columnKey', 'name');
      fixture.componentRef.setInput('columnName', 'Name');
      fixture.componentRef.setInput('filterType', 'text');
      fixture.detectChanges();

      const filterButton = fixture.debugElement.query(
        By.css('button[aria-label="Filter Name"]')
      );

      // Open popover
      filterButton.nativeElement.click();
      fixture.detectChanges();
      expect(component.isFilterOpen()).toBe(true);
      let popover = fixture.debugElement.query(By.css('.ogrid-header-filter__popover'));
      expect(popover).toBeTruthy();

      // Close popover
      filterButton.nativeElement.click();
      fixture.detectChanges();
      expect(component.isFilterOpen()).toBe(false);
      popover = fixture.debugElement.query(By.css('.ogrid-header-filter__popover'));
      expect(popover).toBeNull();
    });

    it('should show active indicator when filter has value', () => {
      fixture.componentRef.setInput('columnKey', 'name');
      fixture.componentRef.setInput('columnName', 'Name');
      fixture.componentRef.setInput('filterType', 'text');
      fixture.componentRef.setInput('textValue', 'test');
      fixture.detectChanges();

      const filterButton = fixture.debugElement.query(
        By.css('button[aria-label="Filter Name"]')
      );
      const dot = filterButton.query(By.css('.ogrid-header-filter__dot'));
      expect(dot).toBeTruthy();
    });
  });

  describe('Text filter', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('columnKey', 'name');
      fixture.componentRef.setInput('columnName', 'Name');
      fixture.componentRef.setInput('filterType', 'text');
      fixture.componentRef.setInput('textValue', '');
      fixture.componentRef.setInput('onTextChange', jest.fn());
    });

    it('should render text input when popover open', () => {
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      const input = fixture.debugElement.query(
        By.css('input[type="text"][placeholder="Enter search term..."]')
      );
      expect(input).toBeTruthy();
    });

    it('should call onTextChange when Apply clicked', () => {
      const onTextChangeMock = jest.fn();
      fixture.componentRef.setInput('onTextChange', onTextChangeMock);
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      const input = fixture.debugElement.query(
        By.css('input[type="text"][placeholder="Enter search term..."]')
      );
      input.nativeElement.value = 'test value';
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const applyButton = fixture.debugElement.queryAll(
        By.css('.ogrid-header-filter__action-btn--primary')
      )[0];
      applyButton.nativeElement.click();

      expect(onTextChangeMock).toHaveBeenCalledWith('test value');
    });

    it('should call onTextChange with empty string when Clear clicked', () => {
      const onTextChangeMock = jest.fn();
      fixture.componentRef.setInput('onTextChange', onTextChangeMock);
      fixture.componentRef.setInput('textValue', 'existing');
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      const clearButton = fixture.debugElement.queryAll(
        By.css('.ogrid-header-filter__action-btn')
      )[0];
      clearButton.nativeElement.click();

      expect(onTextChangeMock).toHaveBeenCalledWith('');
    });

    it('should disable Clear button when no text value', () => {
      fixture.componentRef.setInput('textValue', '');
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      const clearButton = fixture.debugElement.queryAll(
        By.css('.ogrid-header-filter__action-btn')
      )[0];
      expect(clearButton.nativeElement.disabled).toBe(true);
    });
  });

  describe('MultiSelect filter', () => {
    const options = ['Option 1', 'Option 2', 'Option 3'];

    beforeEach(() => {
      fixture.componentRef.setInput('columnKey', 'status');
      fixture.componentRef.setInput('columnName', 'Status');
      fixture.componentRef.setInput('filterType', 'multiSelect');
      fixture.componentRef.setInput('options', options);
      fixture.componentRef.setInput('selectedValues', []);
      fixture.componentRef.setInput('onFilterChange', jest.fn());
    });

    it('should render options list when popover open', () => {
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      const optionLabels = fixture.debugElement.queryAll(
        By.css('.ogrid-header-filter__option')
      );
      expect(optionLabels.length).toBe(3);
    });

    it('should show loading state', () => {
      fixture.componentRef.setInput('isLoadingOptions', true);
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      const loading = fixture.debugElement.query(By.css('.ogrid-header-filter__loading'));
      expect(loading).toBeTruthy();
      expect(loading.nativeElement.textContent).toContain('Loading');
    });

    it('should filter options based on search text', () => {
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      const searchInput = fixture.debugElement.query(
        By.css('input[type="text"][placeholder="Search..."]')
      );
      searchInput.nativeElement.value = '2';
      searchInput.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const optionLabels = fixture.debugElement.queryAll(
        By.css('.ogrid-header-filter__option')
      );
      expect(optionLabels.length).toBe(1);
      expect(optionLabels[0].nativeElement.textContent).toContain('Option 2');
    });

    it('should show empty state when no options match search', () => {
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      const searchInput = fixture.debugElement.query(
        By.css('input[type="text"][placeholder="Search..."]')
      );
      searchInput.nativeElement.value = 'nonexistent';
      searchInput.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const empty = fixture.debugElement.query(By.css('.ogrid-header-filter__empty'));
      expect(empty).toBeTruthy();
      expect(empty.nativeElement.textContent).toContain('No options found');
    });

    it('should check selected options', () => {
      fixture.componentRef.setInput('selectedValues', ['Option 1', 'Option 3']);
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      const checkboxes = fixture.debugElement.queryAll(
        By.css('.ogrid-header-filter__option input[type="checkbox"]')
      );
      expect(checkboxes[0].nativeElement.checked).toBe(true);
      expect(checkboxes[1].nativeElement.checked).toBe(false);
      expect(checkboxes[2].nativeElement.checked).toBe(true);
    });

    it('should call onFilterChange when Apply clicked', () => {
      const onFilterChangeMock = jest.fn();
      fixture.componentRef.setInput('onFilterChange', onFilterChangeMock);
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      // Toggle first checkbox
      const checkboxes = fixture.debugElement.queryAll(
        By.css('.ogrid-header-filter__option input[type="checkbox"]')
      );
      checkboxes[0].nativeElement.checked = true;
      checkboxes[0].nativeElement.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      const applyButton = fixture.debugElement.queryAll(
        By.css('.ogrid-header-filter__action-btn--primary')
      )[0];
      applyButton.nativeElement.click();

      expect(onFilterChangeMock).toHaveBeenCalledWith(['Option 1']);
    });

    it('should select all filtered options when Select All clicked', () => {
      const onFilterChangeMock = jest.fn();
      fixture.componentRef.setInput('onFilterChange', onFilterChangeMock);
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      const selectAllButton = fixture.debugElement.queryAll(
        By.css('.ogrid-header-filter__select-actions .ogrid-header-filter__action-btn')
      )[0];
      selectAllButton.nativeElement.click();
      fixture.detectChanges();

      const applyButton = fixture.debugElement.queryAll(
        By.css('.ogrid-header-filter__action-btn--primary')
      )[0];
      applyButton.nativeElement.click();

      expect(onFilterChangeMock).toHaveBeenCalledWith(['Option 1', 'Option 2', 'Option 3']);
    });

    it('should clear selection when Clear clicked in multiSelect actions', () => {
      fixture.componentRef.setInput('selectedValues', ['Option 1', 'Option 2']);
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      const clearButton = fixture.debugElement.queryAll(
        By.css('.ogrid-header-filter__select-actions .ogrid-header-filter__action-btn')
      )[1];
      clearButton.nativeElement.click();
      fixture.detectChanges();

      const checkboxes = fixture.debugElement.queryAll(
        By.css('.ogrid-header-filter__option input[type="checkbox"]')
      );
      expect(checkboxes.every((cb) => !cb.nativeElement.checked)).toBe(true);
    });
  });

  describe('Date filter', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('columnKey', 'createdDate');
      fixture.componentRef.setInput('columnName', 'Created Date');
      fixture.componentRef.setInput('filterType', 'date');
      fixture.componentRef.setInput('onDateChange', jest.fn());
    });

    it('should render date operator dropdown', () => {
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      const select = fixture.debugElement.query(By.css('select'));
      expect(select).toBeTruthy();
    });

    it('should render date input fields', () => {
      component.isFilterOpen.set(true);
      fixture.detectChanges();

      const dateInputs = fixture.debugElement.queryAll(By.css('input[type="date"]'));
      expect(dateInputs.length).toBeGreaterThan(0);
    });
  });
});
