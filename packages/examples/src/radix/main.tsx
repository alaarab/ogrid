import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { OGrid } from '@alaarab/ogrid-react-radix';
import type { IOGridApi } from '@alaarab/ogrid-react-radix';
import { DatePickerEditor, RatingEditor, ColorPickerEditor, SliderEditor, TagsEditor } from '@alaarab/ogrid-react-inputs';
import { createThemeToggle } from '../shared/themeToggle';
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';
import { createProjectExampleScenario } from '../shared/demoScenario';
import { getExampleFeatureFlags } from '../shared/queryFlags';
import { makePremiumInputColumns, makePremiumInputRows } from '../shared/premiumInputsData';

type ExampleRow = { id: string; [key: string]: unknown };

const featureFlags = getExampleFeatureFlags(typeof window !== 'undefined' ? window.location.search : '');
const projectScenario = createProjectExampleScenario(featureFlags);
const isPremiumExample = featureFlags.premiumInputs;
const initialRows = isPremiumExample
  ? makePremiumInputRows()
  : projectScenario.data;
const columns = isPremiumExample
  ? makePremiumInputColumns({
    dateEditor: DatePickerEditor,
    ratingEditor: RatingEditor,
    colorEditor: ColorPickerEditor,
    sliderEditor: SliderEditor,
    tagsEditor: TagsEditor,
  })
  : projectScenario.columns;

function App() {
  const [data, setData] = useState<ExampleRow[]>(initialRows as ExampleRow[]);
  const apiRef = useRef<IOGridApi<ExampleRow> | null>(null);
  const gridDataProps = !isPremiumExample && projectScenario.serverSide
    ? { dataSource: projectScenario.dataSource! }
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
      getData: () => apiRef.current?.getDisplayedRows() ?? data,
      getColumns: () => columns.map((column) => ({
        columnId: column.columnId,
        headerName: column.name ?? column.columnId,
        type: column.type,
      })),
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
        columns={columns}
        getRowId={(row) => row.id}
        entityLabelPlural={isPremiumExample ? 'products' : 'projects'}
        title={<h2 style={{ margin: 0 }}>{isPremiumExample ? 'Products' : 'Projects'}</h2>}
        defaultPageSize={isPremiumExample ? 10 : 25}
        {...gridDataProps}
        editable={isPremiumExample || !projectScenario.serverSide}
        cellSelection
        cellReferences={isPremiumExample ? undefined : featureFlags.cellReferences}
        rowSelection={isPremiumExample ? undefined : projectScenario.rowSelection}
        formulas={isPremiumExample ? undefined : projectScenario.formulas}
        initialFormulas={isPremiumExample ? undefined : projectScenario.initialFormulas}
        statusBar
        onCellValueChanged={onCellValueChanged}
      />
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) createRoot(rootEl).render(<App />);

createThemeToggle();
