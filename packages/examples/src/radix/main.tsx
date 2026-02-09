import React from 'react';
import { createRoot } from 'react-dom/client';
import { OGrid } from '@alaarab/ogrid';
import { makeDemoProjects, makeDemoColumns, getRowId } from '../shared/demoData';
import type { Project } from '../shared/demoData';

const projects = makeDemoProjects(75);
const columns = makeDemoColumns<Project>();

function App() {
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1>OGrid - Radix UI Example</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>
        A fully featured data table powered by <code>@alaarab/ogrid</code>.
        Includes sorting, multi-select &amp; text filtering, column chooser, and pagination.
      </p>
      <OGrid<Project>
        data={projects}
        columns={columns}
        getRowId={getRowId}
        entityLabelPlural="projects"
        title={<h2 style={{ margin: 0 }}>Projects</h2>}
        defaultPageSize={20}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
