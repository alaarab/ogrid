import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { OGrid } from '@alaarab/ogrid-react-fluent';
import { makeDemoProjects, makeDemoColumns, getRowId } from '../shared/demoData';
import type { Project } from '../shared/demoData';
import { createThemeToggle, getInitialTheme, setTheme } from '../shared/themeToggle';

const projects = makeDemoProjects(75);
const columns = makeDemoColumns<Project>();

// Track theme state for React re-renders
let setAppTheme: ((t: 'light' | 'dark') => void) | null = null;

function App() {
  const [theme, setThemeState] = useState(getInitialTheme());
  setAppTheme = (t) => { setThemeState(t); setTheme(t); };

  return (
    <FluentProvider theme={theme === 'dark' ? webDarkTheme : webLightTheme}>
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <h1>OGrid - React Fluent Example</h1>
        <p style={{ color: 'var(--ogrid-fg-secondary, #666)', marginBottom: 16 }}>
          A fully featured data table powered by <code>@alaarab/ogrid-react-fluent</code>.
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
        />
      </div>
    </FluentProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

// Add dark mode toggle — also switch Fluent theme
createThemeToggle((theme) => {
  setAppTheme?.(theme);
});
