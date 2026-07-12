import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { OGrid } from '@alaarab/ogrid-react-radix';
import type { IOGridApi } from '@alaarab/ogrid-react-radix';
import { DatePickerEditor, RatingEditor, ColorPickerEditor, SliderEditor, TagsEditor } from '@alaarab/ogrid-react-inputs';
import { createThemeToggle } from '../shared/themeToggle';
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';
import { createProjectExampleScenario } from '../shared/demoScenario';
import { getExampleFeatureFlags } from '../shared/queryFlags';
import { XlsxExample } from '../shared/xlsxExample';
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

function App() {
  const [data, setData] = useState<ExampleRow[]>(initialRows);
  const apiRef = useRef<IOGridApi<unknown> | null>(null);
  const gridDataProps = !isPremiumExample && projectScenario.serverSide
    ? { dataSource: coerceExampleDataSource(projectScenario.dataSource!) }
    : { data };

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
      gridId: 'radix-demo',
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
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1>OGrid - React Radix Example</h1>
      <p style={{ color: 'var(--ogrid-fg-secondary, #666)', marginBottom: 16 }}>
        {isPremiumExample
          ? <>Premium editor parity mode powered by <code>@alaarab/ogrid-react-inputs</code>.</>
          : <>A fully featured data table powered by <code>@alaarab/ogrid-react-radix</code>.
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
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  if (featureFlags.xlsx) {
    createRoot(rootEl).render(<XlsxExample />);
  } else {
    createRoot(rootEl).render(<App />);
  }
}

createThemeToggle();
