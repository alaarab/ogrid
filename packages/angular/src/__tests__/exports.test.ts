describe('@alaarab/ogrid-angular exports', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;

  beforeAll(() => {
    mod = require('../index');
  });

  it('exports OGridService', () => {
    expect(mod.OGridService).toBeDefined();
  });

  it('exports DataGridStateService', () => {
    expect(mod.DataGridStateService).toBeDefined();
  });

  it('exports OGridLayoutComponent', () => {
    expect(mod.OGridLayoutComponent).toBeDefined();
  });

  it('exports StatusBarComponent', () => {
    expect(mod.StatusBarComponent).toBeDefined();
  });

  it('exports GridContextMenuComponent', () => {
    expect(mod.GridContextMenuComponent).toBeDefined();
  });

  it('exports SideBarComponent', () => {
    expect(mod.SideBarComponent).toBeDefined();
  });

  it('exports MarchingAntsOverlayComponent', () => {
    expect(mod.MarchingAntsOverlayComponent).toBeDefined();
  });

  it('exports EmptyStateComponent', () => {
    expect(mod.EmptyStateComponent).toBeDefined();
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

  it('re-exports core status bar and context menu helpers', () => {
    expect(mod.getStatusBarParts).toBeDefined();
    expect(typeof mod.getStatusBarParts).toBe('function');
    expect(mod.getDataGridStatusBarConfig).toBeDefined();
    expect(typeof mod.getDataGridStatusBarConfig).toBe('function');
    expect(mod.GRID_CONTEXT_MENU_ITEMS).toBeDefined();
    expect(mod.getContextMenuHandlers).toBeDefined();
  });
});
