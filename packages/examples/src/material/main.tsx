import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { OGrid } from '@alaarab/ogrid-react-material';
import { makeDemoProjects, makeDemoColumns, getRowId, handleCellValueChanged } from '../shared/demoData';
import type { Project } from '../shared/demoData';
import { createThemeToggle, getInitialTheme, setTheme } from '../shared/themeToggle';

const projects = makeDemoProjects(75);
const columns = makeDemoColumns<Project>();

const lightTheme = createTheme({ palette: { mode: 'light' } });
const darkTheme = createTheme({ palette: { mode: 'dark' } });

// Track theme state for React re-renders
let setAppTheme: ((t: 'light' | 'dark') => void) | null = null;

function App() {
  const [theme, setThemeState] = useState(getInitialTheme());
  setAppTheme = (t) => { setThemeState(t); setTheme(t); };

  return (
    <ThemeProvider theme={theme === 'dark' ? darkTheme : lightTheme}>
      <CssBaseline />
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <h1>OGrid - React Material Example</h1>
        <p style={{ color: 'var(--ogrid-fg-secondary, #666)', marginBottom: 16 }}>
          A fully featured data table powered by <code>@alaarab/ogrid-react-material</code>.
          Includes sorting, multi-select &amp; text filtering, column chooser, and pagination.
        </p>
        <OGrid<Project>
          data={projects}
          columns={columns}
          getRowId={getRowId}
          entityLabelPlural="projects"
          title={<h2 style={{ margin: 0 }}>Projects</h2>}
          defaultPageSize={25}
          editable
          cellSelection
          statusBar
          onCellValueChanged={(e) => handleCellValueChanged(projects, e)}
        />
      </div>
    </ThemeProvider>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) createRoot(rootEl).render(<App />);

// Add dark mode toggle — also switch MUI theme
createThemeToggle((theme) => {
  setAppTheme?.(theme);
});
