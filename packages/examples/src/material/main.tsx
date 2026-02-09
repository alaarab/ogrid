import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { OGrid } from '@alaarab/ogrid-material';
import { makeDemoProjects, makeDemoColumns, getRowId } from '../shared/demoData';
import type { Project } from '../shared/demoData';

const projects = makeDemoProjects(75);
const columns = makeDemoColumns<Project>();
const theme = createTheme({ palette: { mode: 'light' } });

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <h1>OGrid - Material UI Example</h1>
        <p style={{ color: '#666', marginBottom: 16 }}>
          A fully featured data table powered by <code>@alaarab/ogrid-material</code>.
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
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
