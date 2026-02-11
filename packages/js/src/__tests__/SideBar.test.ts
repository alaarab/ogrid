import { OGrid } from '../OGrid';
import { SideBarState } from '../state/SideBarState';
import type { IColumnDef, OGridOptions } from '../types';

interface TestRow {
  id: number;
  name: string;
  age: number;
  department: string;
}

const testColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'age', name: 'Age', type: 'numeric', sortable: true },
  { columnId: 'department', name: 'Department' },
];

const testData: TestRow[] = [
  { id: 1, name: 'Alice', age: 30, department: 'Engineering' },
  { id: 2, name: 'Bob', age: 25, department: 'Marketing' },
  { id: 3, name: 'Charlie', age: 35, department: 'Sales' },
];

function createGrid(options?: Partial<OGridOptions<TestRow>>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const grid = new OGrid<TestRow>(container, {
    columns: testColumns,
    data: testData,
    getRowId: (item: TestRow) => item.id,
    pageSize: 20,
    cellSelection: false,
    ...options,
  });
  return { container, grid };
}

afterEach(() => {
  document.body.innerHTML = '';
});

// ============================================================
// SideBarState Unit Tests
// ============================================================

describe('SideBarState', () => {
  it('initializes with boolean true', () => {
    const state = new SideBarState(true);
    expect(state.isEnabled).toBe(true);
    expect(state.panels).toEqual(['columns', 'filters']);
    expect(state.position).toBe('right');
    expect(state.activePanel).toBeNull();
    expect(state.isOpen).toBe(false);
    state.destroy();
  });

  it('initializes with boolean false', () => {
    const state = new SideBarState(false);
    expect(state.isEnabled).toBe(false);
    state.destroy();
  });

  it('initializes with ISideBarDef', () => {
    const state = new SideBarState({
      panels: ['columns'],
      position: 'left',
      defaultPanel: 'columns',
    });
    expect(state.isEnabled).toBe(true);
    expect(state.panels).toEqual(['columns']);
    expect(state.position).toBe('left');
    expect(state.activePanel).toBe('columns');
    expect(state.isOpen).toBe(true);
    state.destroy();
  });

  it('initializes with undefined', () => {
    const state = new SideBarState(undefined);
    expect(state.isEnabled).toBe(false);
    state.destroy();
  });

  it('toggle opens and closes panels', () => {
    const state = new SideBarState(true);
    expect(state.activePanel).toBeNull();

    state.toggle('columns');
    expect(state.activePanel).toBe('columns');
    expect(state.isOpen).toBe(true);

    state.toggle('columns');
    expect(state.activePanel).toBeNull();
    expect(state.isOpen).toBe(false);
    state.destroy();
  });

  it('toggle switches between panels', () => {
    const state = new SideBarState(true);
    state.toggle('columns');
    expect(state.activePanel).toBe('columns');

    state.toggle('filters');
    expect(state.activePanel).toBe('filters');
    state.destroy();
  });

  it('close sets activePanel to null', () => {
    const state = new SideBarState(true);
    state.toggle('columns');
    state.close();
    expect(state.activePanel).toBeNull();
    expect(state.isOpen).toBe(false);
    state.destroy();
  });

  it('emits change on toggle', () => {
    const state = new SideBarState(true);
    const handler = jest.fn();
    state.onChange(handler);

    state.toggle('columns');
    expect(handler).toHaveBeenCalledTimes(1);

    state.toggle('columns');
    expect(handler).toHaveBeenCalledTimes(2);
    state.destroy();
  });

  it('unsubscribe removes handler', () => {
    const state = new SideBarState(true);
    const handler = jest.fn();
    const unsub = state.onChange(handler);

    state.toggle('columns');
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
    state.toggle('filters');
    expect(handler).toHaveBeenCalledTimes(1); // No new call
    state.destroy();
  });
});

// ============================================================
// OGrid Sidebar Integration Tests
// ============================================================

describe('OGrid Sidebar', () => {
  it('does not render sidebar when sideBar is not configured', () => {
    const { container, grid } = createGrid();

    const sidebar = container.querySelector('.ogrid-sidebar');
    expect(sidebar).toBeNull();

    grid.destroy();
  });

  it('renders sidebar with tab strip when sideBar=true', () => {
    const { container, grid } = createGrid({ sideBar: true });

    const sidebar = container.querySelector('.ogrid-sidebar');
    expect(sidebar).not.toBeNull();

    const tabs = container.querySelectorAll('.ogrid-sidebar-tab');
    expect(tabs.length).toBe(2); // columns + filters

    grid.destroy();
  });

  it('sidebar tabs have correct aria-labels', () => {
    const { container, grid } = createGrid({ sideBar: true });

    const tabs = container.querySelectorAll('.ogrid-sidebar-tab');
    const labels = Array.from(tabs).map((t) => t.getAttribute('aria-label'));
    expect(labels).toContain('Columns');
    expect(labels).toContain('Filters');

    grid.destroy();
  });

  it('clicking a tab opens the panel', () => {
    const { container, grid } = createGrid({ sideBar: true });

    // Initially no panel open
    let panel = container.querySelector('.ogrid-sidebar-panel');
    expect(panel).toBeNull();

    // Click columns tab
    const tabs = container.querySelectorAll('.ogrid-sidebar-tab');
    (tabs[0] as HTMLButtonElement).click();

    panel = container.querySelector('.ogrid-sidebar-panel');
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute('aria-label')).toBe('Columns');

    grid.destroy();
  });

  it('clicking the same tab again closes the panel', () => {
    const { container, grid } = createGrid({ sideBar: true });

    const tabs = container.querySelectorAll('.ogrid-sidebar-tab');
    const colTab = tabs[0] as HTMLButtonElement;

    colTab.click();
    expect(container.querySelector('.ogrid-sidebar-panel')).not.toBeNull();

    colTab.click();
    expect(container.querySelector('.ogrid-sidebar-panel')).toBeNull();

    grid.destroy();
  });

  it('columns panel lists all columns', () => {
    const { container, grid } = createGrid({ sideBar: true });

    // Open columns panel
    const tabs = container.querySelectorAll('.ogrid-sidebar-tab');
    (tabs[0] as HTMLButtonElement).click();

    const checkboxes = container.querySelectorAll('.ogrid-sidebar-panel input[type="checkbox"]');
    expect(checkboxes.length).toBe(3); // name, age, department

    grid.destroy();
  });

  it('unchecking a column in sidebar hides it in the grid', () => {
    const { container, grid } = createGrid({ sideBar: true });

    // Open columns panel
    const tabs = container.querySelectorAll('.ogrid-sidebar-tab');
    (tabs[0] as HTMLButtonElement).click();

    // Initially 3 header cells
    let headers = container.querySelectorAll('.ogrid-header-cell');
    expect(headers.length).toBe(3);

    // Uncheck the last column (department)
    const checkboxes = container.querySelectorAll('.ogrid-sidebar-panel input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    checkboxes[2].checked = false;
    checkboxes[2].dispatchEvent(new Event('change'));

    headers = container.querySelectorAll('.ogrid-header-cell');
    expect(headers.length).toBe(2);

    grid.destroy();
  });

  it('close button closes the panel', () => {
    const { container, grid } = createGrid({ sideBar: true });

    // Open columns panel
    const tabs = container.querySelectorAll('.ogrid-sidebar-tab');
    (tabs[0] as HTMLButtonElement).click();

    expect(container.querySelector('.ogrid-sidebar-panel')).not.toBeNull();

    // Click close button
    const closeBtn = container.querySelector('[aria-label="Close panel"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();

    expect(container.querySelector('.ogrid-sidebar-panel')).toBeNull();

    grid.destroy();
  });

  it('sidebar renders on left when position=left', () => {
    const { container, grid } = createGrid({
      sideBar: { position: 'left' },
    });

    const sidebarContainer = container.querySelector('.ogrid-sidebar-container');
    const bodyArea = container.querySelector('.ogrid-body-area');
    expect(sidebarContainer).not.toBeNull();
    expect(bodyArea).not.toBeNull();

    // Sidebar container should be the first child of body area
    expect(bodyArea!.firstElementChild).toBe(sidebarContainer);

    grid.destroy();
  });

  it('sidebar renders on right by default', () => {
    const { container, grid } = createGrid({ sideBar: true });

    const sidebarContainer = container.querySelector('.ogrid-sidebar-container');
    const bodyArea = container.querySelector('.ogrid-body-area');
    const tableContainer = container.querySelector('.ogrid-table-container');

    // Table container should be the first child (sidebar after)
    expect(bodyArea!.firstElementChild).toBe(tableContainer);

    grid.destroy();
  });

  it('opens with defaultPanel', () => {
    const { container, grid } = createGrid({
      sideBar: { defaultPanel: 'filters' },
    });

    const panel = container.querySelector('.ogrid-sidebar-panel');
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute('aria-label')).toBe('Filters');

    grid.destroy();
  });

  it('filters panel shows "No filterable columns" when none are filterable', () => {
    const { container, grid } = createGrid({
      sideBar: { defaultPanel: 'filters' },
    });

    const panel = container.querySelector('.ogrid-sidebar-panel');
    expect(panel!.textContent).toContain('No filterable columns');

    grid.destroy();
  });

  it('filters panel shows text filter for filterable columns', () => {
    const columns: IColumnDef<TestRow>[] = [
      { columnId: 'name', name: 'Name', filterable: { type: 'text' } },
      { columnId: 'age', name: 'Age', type: 'numeric' },
      { columnId: 'department', name: 'Department' },
    ];

    const { container, grid } = createGrid({
      columns,
      sideBar: { defaultPanel: 'filters' },
    });

    const filterInput = container.querySelector('.ogrid-sidebar-panel input[type="text"]');
    expect(filterInput).not.toBeNull();
    expect(filterInput!.getAttribute('aria-label')).toBe('Filter Name');

    grid.destroy();
  });

  it('sidebar columns panel has Select All / Clear All buttons', () => {
    const { container, grid } = createGrid({ sideBar: true });

    // Open columns panel
    const tabs = container.querySelectorAll('.ogrid-sidebar-tab');
    (tabs[0] as HTMLButtonElement).click();

    const buttons = container.querySelectorAll('.ogrid-sidebar-action-btn');
    const labels = Array.from(buttons).map((b) => b.textContent);
    expect(labels).toContain('Select All');
    expect(labels).toContain('Clear All');

    grid.destroy();
  });
});
