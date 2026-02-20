/**
 * Shared OGrid sidebar tests for Angular UI packages.
 * Each UI package calls createSideBarTests(OGridComponent) to run these.
 *
 * Tests verify sidebar state management through the OGridService's
 * sideBarState() and related signals.
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

export function createSideBarTests(OGridComponent: new () => OGridInstance): void {
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
    svc.configure(defaultProps);
    instance._testService = svc;
    return instance as OGridTestInstance;
  }

  describe('sideBar', () => {
    it('sidebar is not enabled by default', () => {
      const comp = createComponent();
      expect(comp._testService.sideBarState().isEnabled).toBe(false);
    });

    it('sidebar is enabled when sideBar=true', () => {
      const comp = createComponent({ sideBar: true });
      expect(comp._testService.sideBarState().isEnabled).toBe(true);
    });

    it('sidebar has Columns and Filters panels by default', () => {
      const comp = createComponent({ sideBar: true });
      const state = comp._testService.sideBarState();
      expect(state.panels).toEqual(['columns', 'filters']);
    });

    it('toggle opens the sidebar with specified panel', () => {
      const comp = createComponent({ sideBar: true });
      comp._testService.sideBarState().toggle('columns');
      const state = comp._testService.sideBarState();
      expect(state.activePanel).toBe('columns');
      expect(state.isOpen).toBe(true);
    });

    it('toggle same panel closes it', () => {
      const comp = createComponent({ sideBar: true });
      comp._testService.sideBarState().toggle('columns');
      comp._testService.sideBarState().toggle('columns');
      const state = comp._testService.sideBarState();
      expect(state.activePanel).toBeNull();
      expect(state.isOpen).toBe(false);
    });

    it('switch between panels', () => {
      const comp = createComponent({ sideBar: true });
      comp._testService.sideBarState().toggle('columns');
      expect(comp._testService.sideBarState().activePanel).toBe('columns');
      comp._testService.sideBarState().toggle('filters');
      expect(comp._testService.sideBarState().activePanel).toBe('filters');
      expect(comp._testService.sideBarState().isOpen).toBe(true);
    });

    it('close sets activePanel to null', () => {
      const comp = createComponent({ sideBar: true });
      comp._testService.sideBarState().toggle('filters');
      expect(comp._testService.sideBarState().isOpen).toBe(true);
      comp._testService.sideBarState().close();
      expect(comp._testService.sideBarState().activePanel).toBeNull();
      expect(comp._testService.sideBarState().isOpen).toBe(false);
    });

    it('column visibility can be toggled via service', () => {
      const comp = createComponent({ sideBar: true });
      const chooser = comp._testService.columnChooser();
      expect(chooser.visibleColumns.has('status')).toBe(true);
      chooser.onVisibilityChange('status', false);
      expect(comp._testService.columnChooser().visibleColumns.has('status')).toBe(false);
      comp._testService.columnChooser().onVisibilityChange('status', true);
      expect(comp._testService.columnChooser().visibleColumns.has('status')).toBe(true);
    });

    it('ISideBarDef with panels=["columns"] shows only columns panel', () => {
      const comp = createComponent({ sideBar: { panels: ['columns'] } });
      const state = comp._testService.sideBarState();
      expect(state.panels).toEqual(['columns']);
    });

    it('ISideBarDef with defaultPanel is parsed correctly', () => {
      const comp = createComponent({ sideBar: { defaultPanel: 'columns' } });
      // In real Angular, an effect initializes the active panel from defaultPanel.
      // In tests with mocked effects, we verify the parsed config has the right default.
      const parsed = comp._testService.sideBarParsed();
      expect(parsed.defaultPanel).toBe('columns');
      // Manually toggle to simulate what the effect would do
      comp._testService.sideBarState().toggle('columns');
      expect(comp._testService.sideBarState().activePanel).toBe('columns');
      expect(comp._testService.sideBarState().isOpen).toBe(true);
    });

    it('position defaults to right', () => {
      const comp = createComponent({ sideBar: true });
      expect(comp._testService.sideBarState().position).toBe('right');
    });

    it('position can be set to left', () => {
      const comp = createComponent({ sideBar: { position: 'left' } });
      expect(comp._testService.sideBarState().position).toBe('left');
    });

    it('select all shows all columns via columnChooser', () => {
      const comp = createComponent({ sideBar: true });
      const chooser = comp._testService.columnChooser();
      // Hide all columns
      chooser.onVisibilityChange('name', false);
      chooser.onVisibilityChange('status', false);
      expect(comp._testService.columnChooser().visibleColumns.has('name')).toBe(false);
      expect(comp._testService.columnChooser().visibleColumns.has('status')).toBe(false);
      // Re-show all
      comp._testService.columnChooser().onVisibilityChange('name', true);
      comp._testService.columnChooser().onVisibilityChange('status', true);
      expect(comp._testService.columnChooser().visibleColumns.has('name')).toBe(true);
      expect(comp._testService.columnChooser().visibleColumns.has('status')).toBe(true);
    });
  });
}
