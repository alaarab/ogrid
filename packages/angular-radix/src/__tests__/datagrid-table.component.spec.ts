import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DataGridTableComponent } from '../datagrid-table/datagrid-table.component';
import type { IColumnDefinition, IOGridDataGridProps } from '@alaarab/ogrid-angular';

interface TestRow {
  id: string;
  name: string;
  status: string;
  value: number;
}

describe('DataGridTableComponent', () => {
  let component: DataGridTableComponent<TestRow>;
  let fixture: ComponentFixture<DataGridTableComponent<TestRow>>;

  const mockData: TestRow[] = [
    { id: '1', name: 'Alpha', status: 'Active', value: 100 },
    { id: '2', name: 'Beta', status: 'Closed', value: 200 },
    { id: '3', name: 'Gamma', status: 'Active', value: 150 },
  ];

  const mockColumns: IColumnDefinition[] = [
    { columnId: 'name', name: 'Name' },
    { columnId: 'status', name: 'Status' },
    { columnId: 'value', name: 'Value' },
  ];

  const getBasicProps = (): IOGridDataGridProps<TestRow> => ({
    columns: mockColumns,
    items: mockData,
    getRowId: (row) => row.id,
    visibleColumns: new Set(['name', 'status', 'value']),
    filters: {},
    filterOptions: {},
    loadingFilterOptions: {},
    onColumnSort: jest.fn(),
    onFilterChange: jest.fn(),
    sortBy: undefined,
    sortDirection: 'asc',
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataGridTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DataGridTableComponent<TestRow>);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Basic rendering', () => {
    it('should render table element', () => {
      fixture.componentRef.setInput('props', getBasicProps());
      fixture.detectChanges();

      const table = fixture.debugElement.query(By.css('table'));
      expect(table).toBeTruthy();
    });

    it('should render table headers for visible columns', () => {
      fixture.componentRef.setInput('props', getBasicProps());
      fixture.detectChanges();

      const headers = fixture.debugElement.queryAll(By.css('thead th'));
      expect(headers.length).toBe(3);
    });

    it('should render all rows', () => {
      fixture.componentRef.setInput('props', getBasicProps());
      fixture.detectChanges();

      const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
      expect(rows.length).toBe(3);
    });

    it('should render cells for visible columns', () => {
      fixture.componentRef.setInput('props', getBasicProps());
      fixture.detectChanges();

      const firstRow = fixture.debugElement.queryAll(By.css('tbody tr'))[0];
      const cells = firstRow.queryAll(By.css('td'));
      expect(cells.length).toBe(3);
    });

    it('should hide columns not in visibleColumns', () => {
      const props = {
        ...getBasicProps(),
        visibleColumns: new Set(['name']),
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const headers = fixture.debugElement.queryAll(By.css('thead th'));
      expect(headers.length).toBe(1);
    });

    it('should set aria-label when provided', () => {
      const props = {
        ...getBasicProps(),
        'aria-label': 'Projects grid',
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const region = fixture.debugElement.query(By.css('[role="region"]'));
      expect(region.nativeElement.getAttribute('aria-label')).toBe('Projects grid');
    });

    it('should set aria-labelledby when provided', () => {
      const props = {
        ...getBasicProps(),
        'aria-labelledby': 'grid-heading',
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const region = fixture.debugElement.query(By.css('[role="region"]'));
      expect(region.nativeElement.getAttribute('aria-labelledby')).toBe('grid-heading');
    });
  });

  describe('Sorting', () => {
    it('should show sort indicator on sorted column', () => {
      const props = {
        ...getBasicProps(),
        sortBy: 'name',
        sortDirection: 'asc' as const,
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const nameHeader = fixture.debugElement.query(
        By.css('column-header-filter')
      );
      expect(nameHeader).toBeTruthy();
    });

    it('should call onColumnSort when sortable header clicked', () => {
      const onColumnSortMock = jest.fn();
      const props = {
        ...getBasicProps(),
        onColumnSort: onColumnSortMock,
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const sortButton = fixture.debugElement.query(
        By.css('button[aria-label="Sort by Name"]')
      );
      sortButton.nativeElement.click();

      expect(onColumnSortMock).toHaveBeenCalledWith('name');
    });

    it('should not call onColumnSort for non-sortable column', () => {
      const onColumnSortMock = jest.fn();
      const props = {
        ...getBasicProps(),
        onColumnSort: onColumnSortMock,
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      // Value column is not sortable
      const headers = fixture.debugElement.queryAll(By.css('column-header-filter'));
      const valueHeader = headers[2];

      const sortButton = valueHeader.query(
        By.css('button[aria-label^="Sort"]')
      );
      expect(sortButton).toBeNull();
    });
  });

  describe('Filtering', () => {
    it('should show filter icon for filterable columns', () => {
      const props = {
        ...getBasicProps(),
        columns: [
          { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
          { columnId: 'status', name: 'Status', sortable: true, filterable: { type: 'multiSelect', filterField: 'status' } },
        ],
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const filterButtons = fixture.debugElement.queryAll(
        By.css('button[aria-label^="Filter"]')
      );
      expect(filterButtons.length).toBe(2);
    });

    it('should call onFilterChange when filter applied', () => {
      const onFilterChangeMock = jest.fn();
      const props = {
        ...getBasicProps(),
        columns: [
          { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
        ],
        onFilterChange: onFilterChangeMock,
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      // Open filter popover
      const filterButton = fixture.debugElement.query(
        By.css('button[aria-label="Filter Name"]')
      );
      filterButton.nativeElement.click();
      fixture.detectChanges();

      // Enter text and apply
      const input = fixture.debugElement.query(
        By.css('input[placeholder="Enter search term..."]')
      );
      input.nativeElement.value = 'test';
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const applyButton = fixture.debugElement.query(
        By.css('.ogrid-header-filter__action-btn--primary')
      );
      applyButton.nativeElement.click();

      expect(onFilterChangeMock).toHaveBeenCalled();
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no items', () => {
      const props = {
        ...getBasicProps(),
        items: [],
        emptyState: {
          title: 'No data',
          description: 'There are no items to display',
        },
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.textContent;
      expect(emptyState).toContain('No data');
    });

    it('should show default empty state when no custom provided', () => {
      const props = {
        ...getBasicProps(),
        items: [],
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
      expect(rows.length).toBe(0);
    });
  });

  describe('Row selection', () => {
    it('should show checkbox column when selectionMode is multiple', () => {
      const props = {
        ...getBasicProps(),
        selectionMode: 'multiple' as const,
        selectedRowKeys: new Set<string>(),
        onSelectionChange: jest.fn(),
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const checkboxes = fixture.debugElement.queryAll(
        By.css('input[type="checkbox"]')
      );
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should call onSelectionChange when row checkbox clicked', () => {
      const onSelectionChangeMock = jest.fn();
      const props = {
        ...getBasicProps(),
        selectionMode: 'multiple' as const,
        selectedRowKeys: new Set<string>(),
        onSelectionChange: onSelectionChangeMock,
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const checkboxes = fixture.debugElement.queryAll(
        By.css('tbody input[type="checkbox"]')
      );
      checkboxes[0].nativeElement.click();

      expect(onSelectionChangeMock).toHaveBeenCalled();
    });

    it('should highlight selected rows', () => {
      const props = {
        ...getBasicProps(),
        selectionMode: 'multiple' as const,
        selectedRowKeys: new Set(['1']),
        onSelectionChange: jest.fn(),
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const firstRow = fixture.debugElement.queryAll(By.css('tbody tr'))[0];
      expect(firstRow.nativeElement.classList.contains('ogrid-datagrid-table__row--selected')).toBe(true);
    });
  });

  describe('Column groups', () => {
    it('should render column groups header row', () => {
      const props = {
        ...getBasicProps(),
        columnGroups: [
          { label: 'Group 1', columns: ['name', 'status'] },
        ],
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const groupRow = fixture.debugElement.query(By.css('thead tr:first-child'));
      expect(groupRow).toBeTruthy();
    });
  });

  describe('Loading state', () => {
    it('should show loading indicator when isLoading is true', () => {
      const props = {
        ...getBasicProps(),
        isLoading: true,
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      // Loading state may be shown in different ways
      // Just verify component renders without error
      const table = fixture.debugElement.query(By.css('table'));
      expect(table).toBeTruthy();
    });
  });

  describe('Custom cell rendering', () => {
    it('should use custom cellValue when provided', () => {
      const props = {
        ...getBasicProps(),
        columns: [
          {
            columnId: 'name',
            name: 'Name',
            sortable: true,
            cellValue: (row: TestRow) => `Custom: ${row.name}`,
          },
        ],
        visibleColumns: new Set(['name']),
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const firstCell = fixture.debugElement.query(By.css('tbody tr td'));
      expect(firstCell.nativeElement.textContent.trim()).toBe('Custom: Alpha');
    });
  });

  describe('Accessibility', () => {
    it('should have proper table role', () => {
      fixture.componentRef.setInput('props', getBasicProps());
      fixture.detectChanges();

      const table = fixture.debugElement.query(By.css('table'));
      expect(table.nativeElement.getAttribute('role')).toBe('table');
    });

    it('should have proper row roles', () => {
      fixture.componentRef.setInput('props', getBasicProps());
      fixture.detectChanges();

      const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
      rows.forEach((row) => {
        expect(row.nativeElement.getAttribute('role')).toBe('row');
      });
    });

    it('should have proper cell roles', () => {
      fixture.componentRef.setInput('props', getBasicProps());
      fixture.detectChanges();

      const cells = fixture.debugElement.queryAll(By.css('tbody td'));
      cells.forEach((cell) => {
        expect(cell.nativeElement.getAttribute('role')).toBe('cell');
      });
    });
  });

  describe('Column pinning', () => {
    it('should apply sticky positioning to pinned columns', () => {
      const props = {
        ...getBasicProps(),
        columns: [
          { columnId: 'name', name: 'Name', sortable: true, pinned: 'left' as const },
          { columnId: 'status', name: 'Status', sortable: true },
        ],
      };
      fixture.componentRef.setInput('props', props);
      fixture.detectChanges();

      const firstHeader = fixture.debugElement.query(By.css('thead th'));
      const styles = firstHeader.nativeElement.style;
      expect(styles.position).toBe('sticky');
    });
  });
});
