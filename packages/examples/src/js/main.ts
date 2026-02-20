import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { makeDemoProjects, makeDemoColumns, getRowId, handleCellValueChanged } from '../shared/demoData';
import type { Project } from '../shared/demoData';
import { createThemeToggle } from '../shared/themeToggle';

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
(window as unknown as Record<string, unknown>).gridApi = grid.getApi();

// Add dark mode toggle
createThemeToggle();
