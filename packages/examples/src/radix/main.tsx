import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { OGrid } from '@alaarab/ogrid-react-radix';
import { makeDemoProjects, makeDemoColumns, getRowId } from '../shared/demoData';
import type { Project } from '../shared/demoData';
import { createThemeToggle } from '../shared/themeToggle';

const initialProjects = makeDemoProjects(75);
const columns = makeDemoColumns<Project>();

function App() {
  const [data, setData] = useState(initialProjects);

  const onCellValueChanged = useCallback((e: { item: Project; columnId: string; newValue: unknown }) => {
    setData((prev) =>
      prev.map((row) =>
        row.id === e.item.id ? { ...row, [e.columnId]: e.newValue } : row,
      ),
    );
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1>OGrid - React Radix Example</h1>
      <p style={{ color: 'var(--ogrid-fg-secondary, #666)', marginBottom: 16 }}>
        A fully featured data table powered by <code>@alaarab/ogrid-react-radix</code>.
        Includes sorting, multi-select &amp; text filtering, column chooser, and pagination.
      </p>
      <OGrid<Project>
        data={data}
        columns={columns}
        getRowId={getRowId}
        entityLabelPlural="projects"
        title={<h2 style={{ margin: 0 }}>Projects</h2>}
        defaultPageSize={25}
        editable
        cellSelection
        statusBar
        onCellValueChanged={onCellValueChanged}
      />
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) createRoot(rootEl).render(<App />);

// Add dark mode toggle
createThemeToggle();
