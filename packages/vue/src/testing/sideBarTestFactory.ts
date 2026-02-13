/**
 * Shared SideBar tests for Vue.
 * Each Vue UI package calls createSideBarTests() to run these.
 * Tests useSideBarState composable + useOGrid sidebar integration.
 */
import { ref } from 'vue';
import { useSideBarState } from '../composables/useSideBarState';
import { useOGrid } from '../composables/useOGrid';
import type { IOGridProps, IOGridClientProps } from '../types';
import { fixtureRows, fixtureColumns, getRowId, type FixtureRow } from './fixtures';

function createOGrid(overrides: Partial<IOGridClientProps<FixtureRow>> = {}) {
  const defaultProps: IOGridClientProps<FixtureRow> = {
    columns: fixtureColumns,
    getRowId,
    data: fixtureRows,
    defaultPageSize: 10,
    ...overrides,
  };
  const props = ref<IOGridProps<FixtureRow>>(defaultProps);
  return useOGrid(props);
}

export function createSideBarTests(): void {
  describe('sideBar', () => {
    it('sidebar is not enabled by default', () => {
      const { layout } = createOGrid();
      expect(layout.value.sideBarProps).toBeNull();
    });

    it('sidebar is enabled when sideBar=true', () => {
      const { layout } = createOGrid({ sideBar: true });
      expect(layout.value.sideBarProps).not.toBeNull();
    });

    it('Columns and Filters panels are available by default', () => {
      const { layout } = createOGrid({ sideBar: true });
      const sb = layout.value.sideBarProps!;
      expect(sb.panels).toContain('columns');
      expect(sb.panels).toContain('filters');
    });

    it('toggle opens and closes panels', () => {
      const { layout } = createOGrid({ sideBar: true });
      const sb = layout.value.sideBarProps!;
      expect(sb.activePanel).toBeNull();
      expect(sb.isOpen).toBe(false);

      sb.toggle('columns');
      expect(sb.activePanel).toBe('columns');
      expect(sb.isOpen).toBe(true);

      sb.toggle('columns');
      expect(sb.activePanel).toBeNull();
      expect(sb.isOpen).toBe(false);
    });

    it('switches between panels', () => {
      const { layout } = createOGrid({ sideBar: true });
      const sb = layout.value.sideBarProps!;

      sb.toggle('columns');
      expect(sb.activePanel).toBe('columns');

      sb.toggle('filters');
      expect(sb.activePanel).toBe('filters');
    });

    it('close sets activePanel to null', () => {
      const { layout } = createOGrid({ sideBar: true });
      const sb = layout.value.sideBarProps!;

      sb.toggle('filters');
      expect(sb.isOpen).toBe(true);

      sb.close();
      expect(sb.activePanel).toBeNull();
      expect(sb.isOpen).toBe(false);
    });

    it('sidebar columns list matches grid columns', () => {
      const { layout } = createOGrid({ sideBar: true });
      const sb = layout.value.sideBarProps!;
      expect(sb.columns).toHaveLength(2);
      expect(sb.columns.map((c) => c.columnId)).toEqual(['name', 'status']);
    });

    it('column visibility can be toggled from sidebar', () => {
      const { layout, columnChooser } = createOGrid({ sideBar: true });
      const sb = layout.value.sideBarProps!;

      expect(sb.visibleColumns.has('status')).toBe(true);
      sb.onVisibilityChange('status', false);
      expect(columnChooser.value.visibleColumns.has('status')).toBe(false);
    });

    it('respects ISideBarDef with only columns panel', () => {
      const { layout } = createOGrid({ sideBar: { panels: ['columns'] } });
      const sb = layout.value.sideBarProps!;
      expect(sb.panels).toEqual(['columns']);
    });

    it('respects ISideBarDef with defaultPanel auto-opens', () => {
      const { layout } = createOGrid({ sideBar: { defaultPanel: 'columns' } });
      const sb = layout.value.sideBarProps!;
      expect(sb.activePanel).toBe('columns');
      expect(sb.isOpen).toBe(true);
    });

    it('renders sidebar on left when position is left', () => {
      const { layout } = createOGrid({ sideBar: { position: 'left' } });
      const sb = layout.value.sideBarProps!;
      expect(sb.position).toBe('left');
    });

    it('renders sidebar on right by default', () => {
      const { layout } = createOGrid({ sideBar: true });
      const sb = layout.value.sideBarProps!;
      expect(sb.position).toBe('right');
    });

    it('select all / clear all via sidebar onSetVisibleColumns', () => {
      const { layout, columnChooser } = createOGrid({ sideBar: true });
      const sb = layout.value.sideBarProps!;

      // Clear all: set empty
      sb.onSetVisibleColumns(new Set());
      expect(columnChooser.value.visibleColumns.size).toBe(0);

      // Select all: set both
      sb.onSetVisibleColumns(new Set(['name', 'status']));
      expect(columnChooser.value.visibleColumns.size).toBe(2);
    });
  });

  describe('useSideBarState standalone', () => {
    it('not enabled when config is undefined', () => {
      const state = useSideBarState({ config: undefined });
      expect(state.isEnabled).toBe(false);
    });

    it('not enabled when config is false', () => {
      const state = useSideBarState({ config: false });
      expect(state.isEnabled).toBe(false);
    });

    it('enabled when config is true', () => {
      const state = useSideBarState({ config: true });
      expect(state.isEnabled).toBe(true);
      expect(state.panels).toEqual(['columns', 'filters']);
      expect(state.position).toBe('right');
      expect(state.activePanel.value).toBeNull();
    });

    it('toggle and close work', () => {
      const state = useSideBarState({ config: true });
      state.toggle('columns');
      expect(state.activePanel.value).toBe('columns');
      expect(state.isOpen.value).toBe(true);
      state.close();
      expect(state.activePanel.value).toBeNull();
      expect(state.isOpen.value).toBe(false);
    });
  });
}
