import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { makeDemoProjects, makeDemoColumns, getRowId, handleCellValueChanged } from '../shared/demoData';
import type { Project } from '../shared/demoData';
import { createThemeToggle } from '../shared/themeToggle';
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';

const projects = makeDemoProjects(75);
const columns = makeDemoColumns<Project>();

const container = document.getElementById('grid-container');
if (!container) {
  throw new Error('Grid container not found');
}

const grid = new OGrid<Project>(container, {
  data: projects,
  columns,
  getRowId,
  entityLabelPlural: 'projects',
  defaultPageSize: 25,
  editable: true,
  cellSelection: true,
  statusBar: true,
  onCellValueChanged: (e) => handleCellValueChanged(projects, e),
});

// Expose grid API to window for debugging
(window as unknown as Record<string, unknown>).gridApi = grid.api;

// MCP Live Testing Bridge (dev only)
if (location.hostname === 'localhost') {
  const api = grid.api;
  const _bridge = connectGridToBridge({
    gridId: 'js-demo',
    getData: () => api.getDisplayedRows(),
    getColumns: () => columns.map((c) => ({
      columnId: c.columnId,
      headerName: c.name ?? c.columnId,
      type: c.type,
    })),
    getSort: () => {
      const state = api.getColumnState();
      if (state.sort) {
        return [{ columnId: state.sort.field, direction: state.sort.direction }];
      }
      return [];
    },
    getFilters: () => {
      const state = api.getColumnState();
      return (state.filters ?? {}) as Record<string, unknown>;
    },
    api: {
      updateSort: (model) => {
        const first = model[0];
        api.applyColumnState({
          sort: first ? { field: first.columnId, direction: first.direction } : undefined,
        });
      },
      updateFilter: (columnId, value) => {
        const current = api.getColumnState().filters ?? {};
        api.setFilterModel({ ...current, [columnId]: value } as import('@alaarab/ogrid-core').IFilters);
      },
      clearFilters: () => api.clearFilters(),
    },
    onCellUpdate: (rowIndex, columnId, value) => {
      if (projects[rowIndex]) {
        (projects[rowIndex] as Record<string, unknown>)[columnId] = value;
      }
    },
  });
}

// Add dark mode toggle
createThemeToggle();
