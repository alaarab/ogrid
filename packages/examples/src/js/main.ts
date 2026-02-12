import { OGrid } from '@alaarab/ogrid-js';
import { makeDemoProjects, makeDemoColumns, getRowId } from '../shared/demoData';
import type { Project } from '../shared/demoData';

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
});

// Expose grid API to window for debugging
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).gridApi = grid.getApi();
