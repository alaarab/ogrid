/**
 * Shared OGrid (top-level component) tests for Angular UI packages.
 * Each UI package calls createOGridTests(OGridComponent) to run these.
 *
 * Since Angular mocks do not support template rendering, these tests
 * instantiate the component class directly and verify behavior through
 * the underlying OGridService signals.
 */
import { OGridService } from '../services/ogrid.service';
import { fixtureRows, fixtureColumns, getRowId } from './fixtures';
import type { FixtureRow } from './fixtures';
import type { IOGridProps } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createOGridTests(OGridComponent: new (...args: any[]) => any): void {
  // Helper: get OGridService from component (supports both `ogridService` and `service` property names)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getService(instance: any): OGridService<FixtureRow> {
    if (instance.ogridService instanceof OGridService) return instance.ogridService;
    if (instance.service instanceof OGridService) return instance.service;
    // If inject() returned undefined in mock env, create and attach the service
    const svc = new OGridService<FixtureRow>();
    if ('ogridService' in instance) instance.ogridService = svc;
    else if ('service' in instance) instance.service = svc;
    else instance.ogridService = svc;
    return svc;
  }

  function createComponent(overrides: Partial<IOGridProps<FixtureRow>> = {}) {
    const instance = new OGridComponent();
    const svc = getService(instance);
    const defaultProps: IOGridProps<FixtureRow> = {
      data: fixtureRows,
      columns: fixtureColumns,
      getRowId,
      entityLabelPlural: 'items',
      defaultPageSize: 10,
      ...overrides,
    } as IOGridProps<FixtureRow>;
    // Set the props input (decorator-based @Input, not signal)
    instance.props = defaultProps;
    // Trigger configure
    svc.configure(defaultProps);
    // Attach canonical accessor for tests
    instance._testService = svc;
    return instance;
  }

  it('instantiates and has ogridService', () => {
    const comp = createComponent();
    expect(comp).toBeTruthy();
    expect(comp._testService).toBeInstanceOf(OGridService);
  });

  it('service processes data and returns correct items', () => {
    const comp = createComponent();
    const dgProps = comp._testService.dataGridProps();
    expect(dgProps.items).toEqual(fixtureRows);
    expect(dgProps.items.length).toBe(3);
  });

  it('pagination returns correct state', () => {
    const comp = createComponent({ defaultPageSize: 10 });
    const pagination = comp._testService.pagination();
    expect(pagination.page).toBe(1);
    expect(pagination.pageSize).toBe(10);
    expect(pagination.displayTotalCount).toBe(3);
  });

  it('pagination pages items when pageSize is smaller', () => {
    const comp = createComponent({ defaultPageSize: 2 });
    const dgProps = comp._testService.dataGridProps();
    expect(dgProps.items.length).toBe(2);
    expect(dgProps.items.map((r: FixtureRow) => r.name)).toEqual(['Alpha', 'Beta']);
    expect(comp._testService.pagination().displayTotalCount).toBe(3);
  });

  it('setPage changes the current page', () => {
    const comp = createComponent({ defaultPageSize: 2 });
    comp._testService.pagination().setPage(2);
    expect(comp._testService.pagination().page).toBe(2);
    const dgProps = comp._testService.dataGridProps();
    expect(dgProps.items.map((r: FixtureRow) => r.name)).toEqual(['Gamma']);
  });

  it('setPageSize changes page size and resets to page 1', () => {
    const comp = createComponent({ defaultPageSize: 2 });
    comp._testService.pagination().setPage(2);
    comp._testService.pagination().setPageSize(25);
    expect(comp._testService.pagination().pageSize).toBe(25);
    expect(comp._testService.pagination().page).toBe(1);
  });

  it('handleVisibilityChange hides/shows columns', () => {
    const comp = createComponent();
    const chooser = comp._testService.columnChooser();
    expect(chooser.visibleColumns.has('name')).toBe(true);
    chooser.onVisibilityChange('name', false);
    expect(comp._testService.columnChooser().visibleColumns.has('name')).toBe(false);
    comp._testService.columnChooser().onVisibilityChange('name', true);
    expect(comp._testService.columnChooser().visibleColumns.has('name')).toBe(true);
  });

  it('sorting changes item order via service API', () => {
    const comp = createComponent({ defaultSortBy: 'name', defaultSortDirection: 'desc' });
    const dgProps = comp._testService.dataGridProps();
    expect(dgProps.items.map((r: FixtureRow) => r.name)).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('filtering reduces visible rows via service API', () => {
    const comp = createComponent();
    comp._testService.getApi().setFilterModel({ status: { type: 'multiSelect', value: ['Closed'] } });
    const dgProps = comp._testService.dataGridProps();
    expect(dgProps.items.map((r: FixtureRow) => r.name)).toEqual(['Beta']);
  });

  it('columnChooser=false sets placement to none', () => {
    const comp = createComponent({ columnChooser: false });
    expect(comp._testService.columnChooserPlacement()).toBe('none');
  });

  it('columnChooser="sidebar" sets placement to sidebar', () => {
    const comp = createComponent({ columnChooser: 'sidebar' });
    expect(comp._testService.columnChooserPlacement()).toBe('sidebar');
  });

  it('integration: filter + sort + paginate work together', () => {
    const comp = createComponent({ defaultPageSize: 10, defaultSortBy: 'name', defaultSortDirection: 'asc' });
    // Filter to Active only
    comp._testService.getApi().setFilterModel({ status: { type: 'multiSelect', value: ['Active'] } });
    let dgProps = comp._testService.dataGridProps();
    expect(dgProps.items.map((r: FixtureRow) => r.name)).toEqual(['Alpha', 'Gamma']);

    // Change sort to desc
    comp._testService.controlledSort.set({ field: 'name', direction: 'desc' });
    dgProps = comp._testService.dataGridProps();
    expect(dgProps.items.map((r: FixtureRow) => r.name)).toEqual(['Gamma', 'Alpha']);

    // Paginate
    comp._testService.defaultPageSize.set(1);
    dgProps = comp._testService.dataGridProps();
    expect(dgProps.items.length).toBe(1);
  });
}
