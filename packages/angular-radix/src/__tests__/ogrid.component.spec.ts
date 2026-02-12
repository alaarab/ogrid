import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { OGridComponent } from '../ogrid/ogrid.component';
import type { IOGridProps } from '@alaarab/ogrid-angular';

interface TestRow {
  id: string;
  name: string;
  status: string;
}

describe('OGridComponent', () => {
  let component: OGridComponent<TestRow>;
  let fixture: ComponentFixture<OGridComponent<TestRow>>;

  const mockData: TestRow[] = [
    { id: '1', name: 'Alpha', status: 'Active' },
    { id: '2', name: 'Beta', status: 'Closed' },
    { id: '3', name: 'Gamma', status: 'Active' },
  ];

  const getBasicProps = (): IOGridProps<TestRow> => ({
    columns: [
      { columnId: 'name', name: 'Name', sortable: true },
      { columnId: 'status', name: 'Status', sortable: true },
    ],
    data: mockData,
    getRowId: (row) => row.id,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OGridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OGridComponent<TestRow>);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should create OGridService instance', () => {
    expect(component.ogridService).toBeTruthy();
  });

  it('should render OGridLayoutComponent', () => {
    fixture.componentRef.setInput('props', getBasicProps());
    fixture.detectChanges();

    const layout = fixture.debugElement.query(By.css('ogrid-layout'));
    expect(layout).toBeTruthy();
  });

  it('should render DataGridTableComponent', () => {
    fixture.componentRef.setInput('props', getBasicProps());
    fixture.detectChanges();

    const dataGrid = fixture.debugElement.query(By.css('ogrid-datagrid-table'));
    expect(dataGrid).toBeTruthy();
  });

  it('should render PaginationControlsComponent', () => {
    fixture.componentRef.setInput('props', getBasicProps());
    fixture.detectChanges();

    const pagination = fixture.debugElement.query(By.css('ogrid-pagination-controls'));
    expect(pagination).toBeTruthy();
  });

  it('should show ColumnChooser when columnChooser is toolbar', () => {
    const props = {
      ...getBasicProps(),
      columnChooser: 'toolbar' as const,
    };
    fixture.componentRef.setInput('props', props);
    fixture.detectChanges();

    const columnChooser = fixture.debugElement.query(By.css('ogrid-column-chooser'));
    expect(columnChooser).toBeTruthy();
  });

  it('should not show ColumnChooser when columnChooser is false', () => {
    const props = {
      ...getBasicProps(),
      columnChooser: false,
    };
    fixture.componentRef.setInput('props', props);
    fixture.detectChanges();

    const columnChooser = fixture.debugElement.query(By.css('ogrid-column-chooser'));
    expect(columnChooser).toBeNull();
  });

  it('should pass dataGridProps to DataGridTable', () => {
    fixture.componentRef.setInput('props', getBasicProps());
    fixture.detectChanges();

    const dataGridProps = component.dataGridProps();
    expect(dataGridProps).toBeDefined();
    expect(dataGridProps.columns).toBeDefined();
    expect(dataGridProps.items).toBeDefined();
  });

  it('should configure OGridService with props', () => {
    const props = getBasicProps();
    fixture.componentRef.setInput('props', props);
    fixture.detectChanges();

    const spy = jest.spyOn(component.ogridService, 'configure');
    component.dataGridProps();
    expect(spy).toHaveBeenCalledWith(props);
  });

  it('should handle page size change and reset to page 1', () => {
    fixture.componentRef.setInput('props', getBasicProps());
    fixture.detectChanges();

    const setPageSizeSpy = jest.spyOn(component.ogridService.pagination(), 'setPageSize');
    const setPageSpy = jest.spyOn(component.ogridService.pagination(), 'setPage');

    component.onPageSizeChange(25);

    expect(setPageSizeSpy).toHaveBeenCalledWith(25);
    expect(setPageSpy).toHaveBeenCalledWith(1);
  });

  it('should support custom className', () => {
    const props = {
      ...getBasicProps(),
      className: 'custom-grid-class',
    };
    fixture.componentRef.setInput('props', props);
    fixture.detectChanges();

    const layout = fixture.debugElement.query(By.css('ogrid-layout'));
    // className is passed as input, verify it's set
    expect(component.ogridService.className()).toBe('custom-grid-class');
  });

  it('should support initial sorting', () => {
    const props = {
      ...getBasicProps(),
      initialSortBy: 'name',
      initialSortDirection: 'desc' as const,
    };
    fixture.componentRef.setInput('props', props);
    fixture.detectChanges();

    // Trigger computation
    component.dataGridProps();

    const sort = component.ogridService.sort();
    expect(sort.field).toBe('name');
    expect(sort.direction).toBe('desc');
  });

  it('should support initial page size', () => {
    const props = {
      ...getBasicProps(),
      initialPageSize: 25,
    };
    fixture.componentRef.setInput('props', props);
    fixture.detectChanges();

    component.dataGridProps();

    const pagination = component.ogridService.pagination();
    expect(pagination.pageSize).toBe(25);
  });

  it('should support custom pagination options', () => {
    const props = {
      ...getBasicProps(),
      pageSizeOptions: [10, 25, 50, 100],
    };
    fixture.componentRef.setInput('props', props);
    fixture.detectChanges();

    component.dataGridProps();

    const pagination = component.ogridService.pagination();
    expect(pagination.pageSizeOptions).toEqual([10, 25, 50, 100]);
  });

  it('should support custom entity label', () => {
    const props = {
      ...getBasicProps(),
      entityLabelPlural: 'projects',
    };
    fixture.componentRef.setInput('props', props);
    fixture.detectChanges();

    component.dataGridProps();

    const pagination = component.ogridService.pagination();
    expect(pagination.entityLabelPlural).toBe('projects');
  });

  it('should support disabling pagination', () => {
    const props = {
      ...getBasicProps(),
      pagination: false,
    };
    fixture.componentRef.setInput('props', props);
    fixture.detectChanges();

    // Component should still render but pagination controls won't be shown
    const layout = fixture.debugElement.query(By.css('ogrid-layout'));
    expect(layout).toBeTruthy();
  });

  it('should support toolbar content', () => {
    const props = {
      ...getBasicProps(),
      toolbar: 'Custom Toolbar Content',
    };
    fixture.componentRef.setInput('props', props);
    fixture.detectChanges();

    expect(component.ogridService.toolbar()).toBe('Custom Toolbar Content');
  });

  it('should support toolbarBelow content', () => {
    const props = {
      ...getBasicProps(),
      toolbarBelow: 'Toolbar Below Content',
    };
    fixture.componentRef.setInput('props', props);
    fixture.detectChanges();

    expect(component.ogridService.toolbarBelow()).toBe('Toolbar Below Content');
  });
});
