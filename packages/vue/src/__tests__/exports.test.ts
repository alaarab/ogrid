describe('@alaarab/ogrid-vue exports', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;

  beforeAll(() => {
    mod = require('../index');
  });

  it('exports useOGrid composable', () => {
    expect(mod.useOGrid).toBeDefined();
    expect(typeof mod.useOGrid).toBe('function');
  });

  it('exports useDataGridState composable', () => {
    expect(mod.useDataGridState).toBeDefined();
    expect(typeof mod.useDataGridState).toBe('function');
  });

  it('exports feature composables', () => {
    expect(mod.useActiveCell).toBeDefined();
    expect(typeof mod.useActiveCell).toBe('function');
    expect(mod.useCellEditing).toBeDefined();
    expect(typeof mod.useCellEditing).toBe('function');
    expect(mod.useCellSelection).toBeDefined();
    expect(typeof mod.useCellSelection).toBe('function');
    expect(mod.useClipboard).toBeDefined();
    expect(typeof mod.useClipboard).toBe('function');
    expect(mod.useRowSelection).toBeDefined();
    expect(typeof mod.useRowSelection).toBe('function');
    expect(mod.useKeyboardNavigation).toBeDefined();
    expect(typeof mod.useKeyboardNavigation).toBe('function');
    expect(mod.useFillHandle).toBeDefined();
    expect(typeof mod.useFillHandle).toBe('function');
    expect(mod.useUndoRedo).toBeDefined();
    expect(typeof mod.useUndoRedo).toBe('function');
  });

  it('exports additional composables', () => {
    expect(mod.useContextMenu).toBeDefined();
    expect(typeof mod.useContextMenu).toBe('function');
    expect(mod.useColumnResize).toBeDefined();
    expect(typeof mod.useColumnResize).toBe('function');
    expect(mod.useFilterOptions).toBeDefined();
    expect(typeof mod.useFilterOptions).toBe('function');
    expect(mod.useDebounce).toBeDefined();
    expect(typeof mod.useDebounce).toBe('function');
    expect(mod.useDebouncedCallback).toBeDefined();
    expect(typeof mod.useDebouncedCallback).toBe('function');
    expect(mod.useTableLayout).toBeDefined();
    expect(typeof mod.useTableLayout).toBe('function');
  });

  it('exports headless state composables', () => {
    expect(mod.useColumnHeaderFilterState).toBeDefined();
    expect(typeof mod.useColumnHeaderFilterState).toBe('function');
    expect(mod.useTextFilterState).toBeDefined();
    expect(typeof mod.useTextFilterState).toBe('function');
    expect(mod.useMultiSelectFilterState).toBeDefined();
    expect(typeof mod.useMultiSelectFilterState).toBe('function');
    expect(mod.usePeopleFilterState).toBeDefined();
    expect(typeof mod.usePeopleFilterState).toBe('function');
    expect(mod.useDateFilterState).toBeDefined();
    expect(typeof mod.useDateFilterState).toBe('function');
    expect(mod.useColumnChooserState).toBeDefined();
    expect(typeof mod.useColumnChooserState).toBe('function');
    expect(mod.useInlineCellEditorState).toBeDefined();
    expect(typeof mod.useInlineCellEditorState).toBe('function');
    expect(mod.useRichSelectState).toBeDefined();
    expect(typeof mod.useRichSelectState).toBe('function');
    expect(mod.useSideBarState).toBeDefined();
    expect(typeof mod.useSideBarState).toBe('function');
  });

  it('exports view model utilities', () => {
    expect(mod.getHeaderFilterConfig).toBeDefined();
    expect(typeof mod.getHeaderFilterConfig).toBe('function');
    expect(mod.getCellRenderDescriptor).toBeDefined();
    expect(typeof mod.getCellRenderDescriptor).toBe('function');
    expect(mod.resolveCellDisplayContent).toBeDefined();
    expect(typeof mod.resolveCellDisplayContent).toBe('function');
    expect(mod.resolveCellStyle).toBeDefined();
    expect(typeof mod.resolveCellStyle).toBe('function');
    expect(mod.buildInlineEditorProps).toBeDefined();
    expect(typeof mod.buildInlineEditorProps).toBe('function');
    expect(mod.buildPopoverEditorProps).toBeDefined();
    expect(typeof mod.buildPopoverEditorProps).toBe('function');
    expect(mod.getCellInteractionProps).toBeDefined();
    expect(typeof mod.getCellInteractionProps).toBe('function');
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
    expect(mod.buildHeaderRows).toBeDefined();
    expect(typeof mod.buildHeaderRows).toBe('function');
    expect(mod.getPaginationViewModel).toBeDefined();
    expect(typeof mod.getPaginationViewModel).toBe('function');
  });

  it('re-exports core helper functions', () => {
    expect(mod.toUserLike).toBeDefined();
    expect(typeof mod.toUserLike).toBe('function');
    expect(mod.isInSelectionRange).toBeDefined();
    expect(typeof mod.isInSelectionRange).toBe('function');
    expect(mod.normalizeSelectionRange).toBeDefined();
    expect(typeof mod.normalizeSelectionRange).toBe('function');
  });
});
