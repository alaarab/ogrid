import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { OGrid } from '@alaarab/ogrid-react-material';
import type { IOGridApi } from '@alaarab/ogrid-react-material';
import { DatePickerEditor, RatingEditor, ColorPickerEditor, SliderEditor, TagsEditor } from '@alaarab/ogrid-react-inputs';
import { createThemeToggle, getInitialTheme, setTheme } from '../shared/themeToggle';
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';
import { createProjectExampleScenario } from '../shared/demoScenario';
import { getExampleFeatureFlags } from '../shared/queryFlags';
import { makePremiumInputColumns, makePremiumInputRows } from '../shared/premiumInputsData';
import {
  coerceExampleColumns,
  coerceExampleDataSource,
  coerceExampleRows,
  type ExampleRow,
} from '../shared/exampleTypes';

const featureFlags = getExampleFeatureFlags(typeof window !== 'undefined' ? window.location.search : '');
const projectScenario = createProjectExampleScenario(featureFlags);
const isPremiumExample = featureFlags.premiumInputs;
const initialRows = coerceExampleRows(isPremiumExample
  ? makePremiumInputRows()
  : projectScenario.data);
const columns = coerceExampleColumns(isPremiumExample
  ? makePremiumInputColumns({
    dateEditor: DatePickerEditor,
    ratingEditor: RatingEditor,
    colorEditor: ColorPickerEditor,
    sliderEditor: SliderEditor,
    tagsEditor: TagsEditor,
  })
  : projectScenario.columns);

const lightTheme = createTheme({ palette: { mode: 'light' } });
const darkTheme = createTheme({ palette: { mode: 'dark' } });

let setAppTheme: ((theme: 'light' | 'dark') => void) | null = null;

function App() {
  const [theme, setThemeState] = useState(getInitialTheme());
  const [data, setData] = useState<ExampleRow[]>(initialRows);
  const apiRef = useRef<IOGridApi<unknown> | null>(null);
  const gridDataProps = !isPremiumExample && projectScenario.serverSide
    ? { dataSource: coerceExampleDataSource(projectScenario.dataSource!) }
    : { data };

  setAppTheme = (nextTheme) => {
    setThemeState(nextTheme);
    setTheme(nextTheme);
  };

  const onCellValueChanged = useCallback((event: { item: ExampleRow; columnId?: string; field?: string; newValue: unknown }) => {
    const columnId = event.columnId ?? event.field;
    if (!columnId) return;
    setData((prev) =>
      prev.map((row) =>
        row.id === event.item.id ? { ...row, [columnId]: event.newValue } : row,
      ),
    );
  }, []);

  useEffect(() => {
    const bridge = connectGridToBridge({
      gridId: 'material-demo',
      getData: () => (apiRef.current?.getDisplayedRows() as ExampleRow[] | undefined) ?? data,
      getColumns: () => columns.flatMap((column) => (
        'columnId' in column
          ? [{ columnId: column.columnId, headerName: column.name ?? column.columnId, type: column.type }]
          : []
      )),
      getSort: () => {
        const state = apiRef.current?.getColumnState();
        if (state?.sort) {
          return [{ columnId: state.sort.field, direction: state.sort.direction }];
        }
        return [];
      },
      getFilters: () => apiRef.current?.getColumnState()?.filters ?? {},
      api: apiRef.current ?? undefined,
      onCellUpdate: (rowIndex, columnId, value) => {
        setData((prev) =>
          prev.map((row, index) => (index === rowIndex ? { ...row, [columnId]: value } : row)),
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
          {isPremiumExample
            ? <>Premium editor parity mode powered by <code>@alaarab/ogrid-react-inputs</code>.</>
            : <>A fully featured data table powered by <code>@alaarab/ogrid-react-material</code>.
              Includes sorting, multi-select &amp; text filtering, column chooser, and pagination.</>}
        </p>
        <OGrid
          ref={apiRef}
          columns={columns as React.ComponentProps<typeof OGrid>['columns']}
          getRowId={(row) => (row as ExampleRow).id}
          entityLabelPlural={isPremiumExample ? 'products' : 'projects'}
          defaultPageSize={isPremiumExample ? 10 : projectScenario.defaultPageSize}
          {...gridDataProps}
          editable={isPremiumExample || !projectScenario.serverSide}
          cellSelection
          cellReferences={isPremiumExample ? undefined : projectScenario.cellReferences}
          rowSelection={isPremiumExample ? undefined : projectScenario.rowSelection}
          formulas={isPremiumExample ? undefined : projectScenario.formulas}
          initialFormulas={isPremiumExample ? undefined : projectScenario.initialFormulas}
          sideBar={isPremiumExample ? undefined : projectScenario.sideBar}
          fullScreen={isPremiumExample ? undefined : projectScenario.fullScreen}
          responsiveColumns={isPremiumExample ? undefined : projectScenario.responsiveColumns}
          density={isPremiumExample ? undefined : projectScenario.density}
          statusBar
          onCellValueChanged={onCellValueChanged as React.ComponentProps<typeof OGrid>['onCellValueChanged']}
        />
      </div>
    </ThemeProvider>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) createRoot(rootEl).render(<App />);

createThemeToggle((theme) => {
  setAppTheme?.(theme);
});
