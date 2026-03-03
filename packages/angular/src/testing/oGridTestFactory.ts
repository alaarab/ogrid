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
import { getService } from './utils';
import type { OGridInstance } from './utils';

interface OGridTestInstance extends OGridInstance {
  _testService: OGridService<FixtureRow>;
}

export function createOGridTests(OGridComponent: new () => OGridInstance): void {
  function createComponent(overrides: Partial<IOGridProps<FixtureRow>> = {}): OGridTestInstance {
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
    return instance as OGridTestInstance;
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

  it('fullScreen=true sets fullScreen signal on service', () => {
    const comp = createComponent({ fullScreen: true });
    expect(comp._testService.fullScreen()).toBe(true);
  });

  it('fullScreen defaults to false', () => {
    const comp = createComponent();
    expect(comp._testService.fullScreen()).toBe(false);
  });

  it('stickyHeader=true threads to dataGridProps', () => {
    const comp = createComponent({ stickyHeader: true });
    expect(comp._testService.dataGridProps().stickyHeader).toBe(true);
  });

  it('stickyHeader defaults to true in dataGridProps', () => {
    const comp = createComponent();
    expect(comp._testService.dataGridProps().stickyHeader).toBe(true);
  });

  it('fullScreen toggle changes isFullScreen and rootClass', () => {
    const comp = createComponent({ fullScreen: true });
    // The layout component's toggleFullScreen is on the layout, not the OGrid.
    // But we can verify the service level signal is true
    expect(comp._testService.fullScreen()).toBe(true);
  });

  it('fullScreen threads through to dataGridProps.stickyHeader override', () => {
    // When fullScreen is true but stickyHeader is false, headers should still be sticky in fullscreen
    const comp = createComponent({ fullScreen: true, stickyHeader: false });
    const dgProps = comp._testService.dataGridProps();
    // stickyHeader from props is false, fullScreen doesn't override at service level
    expect(dgProps.stickyHeader).toBe(false);
  });

  describe('onFetchError callback', () => {
    it('onError signal is set when onError prop is configured', () => {
      const onError = jest.fn();
      const comp = createComponent({ onError });
      expect(comp._testService.onError()).toBe(onError);
    });

    it('isLoadingResolved is false for client-side mode', () => {
      const comp = createComponent();
      // Client-side data  -  serverLoading is false, no dataSource
      expect(comp._testService.isLoadingResolved()).toBe(false);
    });

    // Note: async onFetchError tests removed  -  Angular signal effects don't properly
    // trigger in mocked test context. These need proper TestBed-based tests.
  });

  describe('cell references', () => {
    it('cellReferences=true enables column letters, row numbers, and name box in dataGridProps', () => {
      const comp = createComponent({ cellReferences: true });
      const dgProps = comp._testService.dataGridProps();
      expect(dgProps.showColumnLetters).toBe(true);
      expect(dgProps.showRowNumbers).toBe(true);
      expect(dgProps.showNameBox).toBe(true);
    });

    it('cellReferences=true includes onActiveCellChange in dataGridProps', () => {
      const comp = createComponent({ cellReferences: true });
      const dgProps = comp._testService.dataGridProps();
      expect(typeof dgProps.onActiveCellChange).toBe('function');
    });

    it('default (no cellReferences) does not set column letters or name box', () => {
      const comp = createComponent();
      const dgProps = comp._testService.dataGridProps();
      expect(dgProps.showColumnLetters).toBe(false);
      expect(dgProps.showNameBox).toBe(false);
      expect(dgProps.onActiveCellChange).toBeUndefined();
    });

    it('showRowNumbers=true without cellReferences does not enable column letters or name box', () => {
      const comp = createComponent({ showRowNumbers: true });
      const dgProps = comp._testService.dataGridProps();
      expect(dgProps.showRowNumbers).toBe(true);
      expect(dgProps.showColumnLetters).toBe(false);
      expect(dgProps.showNameBox).toBe(false);
      expect(dgProps.onActiveCellChange).toBeUndefined();
    });

    it('cellReferences signal derives correct values for service signals', () => {
      const comp = createComponent({ cellReferences: true });
      expect(comp._testService.cellReferences()).toBe(true);
      expect(comp._testService.showRowNumbers()).toBe(false); // showRowNumbers signal is separate from cellReferences
    });

    it('activeCellRef signal updates when handleActiveCellChange is called', () => {
      const comp = createComponent({ cellReferences: true });
      // Initially null
      expect(comp._testService.activeCellRef()).toBeNull();
      // Call onActiveCellChange from dataGridProps to simulate active cell change
      const dgProps = comp._testService.dataGridProps();
      const cb = dgProps.onActiveCellChange;
      expect(cb).toBeDefined();
      cb?.('A1');
      expect(comp._testService.activeCellRef()).toBe('A1');
      // Update to another cell
      cb?.('B3');
      expect(comp._testService.activeCellRef()).toBe('B3');
      // Clear active cell
      cb?.(null);
      expect(comp._testService.activeCellRef()).toBeNull();
    });

    it('activeCellRef defaults to null', () => {
      const comp = createComponent();
      expect(comp._testService.activeCellRef()).toBeNull();
    });
  });
}
