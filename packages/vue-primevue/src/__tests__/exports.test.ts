describe('@alaarab/ogrid-vue-primevue exports', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;

  beforeAll(() => {
    mod = require('../index');
  });

  // PrimeVue UI components
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

  // Re-exports from @alaarab/ogrid-vue
  it('re-exports useOGrid composable', () => {
    expect(mod.useOGrid).toBeDefined();
    expect(typeof mod.useOGrid).toBe('function');
  });

  it('re-exports useDataGridState composable', () => {
    expect(mod.useDataGridState).toBeDefined();
    expect(typeof mod.useDataGridState).toBe('function');
  });

  it('re-exports feature composables', () => {
    expect(mod.useActiveCell).toBeDefined();
    expect(mod.useCellEditing).toBeDefined();
    expect(mod.useCellSelection).toBeDefined();
    expect(mod.useClipboard).toBeDefined();
    expect(mod.useRowSelection).toBeDefined();
    expect(mod.useKeyboardNavigation).toBeDefined();
    expect(mod.useFillHandle).toBeDefined();
    expect(mod.useUndoRedo).toBeDefined();
  });

  it('re-exports view model utilities', () => {
    expect(mod.getHeaderFilterConfig).toBeDefined();
    expect(mod.getCellRenderDescriptor).toBeDefined();
    expect(mod.resolveCellDisplayContent).toBeDefined();
    expect(mod.resolveCellStyle).toBeDefined();
    expect(mod.buildInlineEditorProps).toBeDefined();
    expect(mod.buildPopoverEditorProps).toBeDefined();
    expect(mod.getCellInteractionProps).toBeDefined();
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
