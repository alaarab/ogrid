describe('@alaarab/ogrid-angular-radix exports', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;

  beforeAll(() => {
    mod = require('../index');
  });

  // Angular Radix UI components
  it('exports OGridComponent', () => {
    expect(mod.OGridComponent).toBeDefined();
  });

  it('exports DataGridTableComponent', () => {
    expect(mod.DataGridTableComponent).toBeDefined();
  });

  it('exports ColumnHeaderFilterComponent', () => {
    expect(mod.ColumnHeaderFilterComponent).toBeDefined();
  });

  it('exports ColumnChooserComponent', () => {
    expect(mod.ColumnChooserComponent).toBeDefined();
  });

  it('exports PaginationControlsComponent', () => {
    expect(mod.PaginationControlsComponent).toBeDefined();
  });

  // Re-exports from @alaarab/ogrid-angular
  it('re-exports OGridService from angular adapter', () => {
    expect(mod.OGridService).toBeDefined();
  });

  it('re-exports DataGridStateService from angular adapter', () => {
    expect(mod.DataGridStateService).toBeDefined();
  });

  it('re-exports headless components from angular adapter', () => {
    expect(mod.OGridLayoutComponent).toBeDefined();
    expect(mod.StatusBarComponent).toBeDefined();
    expect(mod.GridContextMenuComponent).toBeDefined();
    expect(mod.SideBarComponent).toBeDefined();
  });

  it('re-exports core utility functions', () => {
    expect(mod.flattenColumns).toBeDefined();
    expect(typeof mod.flattenColumns).toBe('function');
    expect(mod.processClientSideData).toBeDefined();
    expect(typeof mod.processClientSideData).toBe('function');
    expect(mod.exportToCsv).toBeDefined();
    expect(typeof mod.exportToCsv).toBe('function');
  });
});
