import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { OGrid } from '@alaarab/ogrid-react-material';
import type { IOGridApi } from '@alaarab/ogrid-react-material';
import { makeDemoProjects, makeDemoColumns, getRowId } from '../shared/demoData';
import type { Project } from '../shared/demoData';
import { createThemeToggle, getInitialTheme, setTheme } from '../shared/themeToggle';
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';

const initialProjects = makeDemoProjects(75);
const columns = makeDemoColumns<Project>();

const lightTheme = createTheme({ palette: { mode: 'light' } });
const darkTheme = createTheme({ palette: { mode: 'dark' } });

// Track theme state for React re-renders
let setAppTheme: ((t: 'light' | 'dark') => void) | null = null;

function App() {
  const [theme, setThemeState] = useState(getInitialTheme());
  const [data, setData] = useState(initialProjects);
  const apiRef = useRef<IOGridApi<Project> | null>(null);
  setAppTheme = (t) => { setThemeState(t); setTheme(t); };

  const onCellValueChanged = useCallback((e: { item: Project; columnId: string; newValue: unknown }) => {
    setData((prev) =>
      prev.map((row) =>
        row.id === e.item.id ? { ...row, [e.columnId]: e.newValue } : row,
      ),
    );
  }, []);

  // MCP Live Testing Bridge  -  connects this grid to your editor for real-time inspection
  useEffect(() => {
    const bridge = connectGridToBridge({
      gridId: 'material-demo',
      getData: () => data,
      getColumns: () => columns.map((c) => ({
        columnId: c.columnId,
        headerName: c.name ?? c.columnId,
        type: c.type,
      })),
      getSort: () => {
        const state = apiRef.current?.getColumnState();
        if (state?.sort) {
          return [{ columnId: state.sort.field, direction: state.sort.direction }];
        }
        return [];
      },
      getFilters: () => {
        const state = apiRef.current?.getColumnState();
        return state?.filters ?? {};
      },
      api: apiRef.current ?? undefined,
      onCellUpdate: (rowIndex, columnId, value) => {
        setData((prev) =>
          prev.map((row, i) => (i === rowIndex ? { ...row, [columnId]: value } : row)),
        );
      },
    });
    return () => bridge.disconnect();
  }, [data]);

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
          ref={apiRef}
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
    </ThemeProvider>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) createRoot(rootEl).render(<App />);

// Add dark mode toggle  -  also switch MUI theme
createThemeToggle((theme) => {
  setAppTheme?.(theme);
});
