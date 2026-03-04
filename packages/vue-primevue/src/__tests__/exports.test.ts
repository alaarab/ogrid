describe('@alaarab/ogrid-vue-primevue exports', () => {
  let mod: Record<string, unknown>;

  beforeAll(() => {
    mod = require('../index');
  });

  it('exports OGrid component', () => {
    expect(mod.OGrid).toBeDefined();
  });

  it('exports DataGridTable component', () => {
    expect(mod.DataGridTable).toBeDefined();
  });

  it('exports ColumnHeaderFilter component', () => {
    expect(mod.ColumnHeaderFilter).toBeDefined();
  });

  it('exports ColumnChooser component', () => {
    expect(mod.ColumnChooser).toBeDefined();
  });

  it('exports PaginationControls component', () => {
    expect(mod.PaginationControls).toBeDefined();
  });

  it('exports ColumnHeaderMenu component', () => {
    expect(mod.ColumnHeaderMenu).toBeDefined();
  });

  it('exports GridContextMenu component', () => {
    expect(mod.GridContextMenu).toBeDefined();
  });

  it('exports InlineCellEditor component', () => {
    expect(mod.InlineCellEditor).toBeDefined();
  });

  it('re-exports composables from vue adapter', () => {
    expect(mod.useOGrid).toBeDefined();
    expect(typeof mod.useOGrid).toBe('function');
    expect(mod.useDataGridState).toBeDefined();
    expect(typeof mod.useDataGridState).toBe('function');
  });

  it('re-exports feature composables', () => {
    expect(mod.useActiveCell).toBeDefined();
    expect(typeof mod.useActiveCell).toBe('function');
    expect(mod.useCellEditing).toBeDefined();
    expect(typeof mod.useCellEditing).toBe('function');
    expect(mod.useRowSelection).toBeDefined();
    expect(typeof mod.useRowSelection).toBe('function');
    expect(mod.useColumnResize).toBeDefined();
    expect(typeof mod.useColumnResize).toBe('function');
  });

  it('re-exports headless state composables', () => {
    expect(mod.useColumnHeaderFilterState).toBeDefined();
    expect(typeof mod.useColumnHeaderFilterState).toBe('function');
    expect(mod.useColumnChooserState).toBeDefined();
    expect(typeof mod.useColumnChooserState).toBe('function');
    expect(mod.useSideBarState).toBeDefined();
    expect(typeof mod.useSideBarState).toBe('function');
  });

  it('re-exports core utility functions', () => {
    expect(mod.flattenColumns).toBeDefined();
    expect(typeof mod.flattenColumns).toBe('function');
    expect(mod.processClientSideData).toBeDefined();
    expect(typeof mod.processClientSideData).toBe('function');
    expect(mod.exportToCsv).toBeDefined();
    expect(typeof mod.exportToCsv).toBe('function');
    expect(mod.getCellValue).toBeDefined();
    expect(typeof mod.getCellValue).toBe('function');
  });

  it('re-exports view model utilities', () => {
    expect(mod.getHeaderFilterConfig).toBeDefined();
    expect(typeof mod.getHeaderFilterConfig).toBe('function');
    expect(mod.getCellRenderDescriptor).toBeDefined();
    expect(typeof mod.getCellRenderDescriptor).toBe('function');
    expect(mod.getCellInteractionProps).toBeDefined();
    expect(typeof mod.getCellInteractionProps).toBe('function');
  });

  it('re-exports StatusBar and MarchingAntsOverlay from base', () => {
    expect(mod.StatusBar).toBeDefined();
    expect(mod.MarchingAntsOverlay).toBeDefined();
  });
});
