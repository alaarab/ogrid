import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import {
  createDatePickerEditor,
  createRatingEditor,
  createColorPickerEditor,
  createSliderEditor,
  createTagsEditor,
} from '@alaarab/ogrid-js-inputs';
import { handleCellValueChanged } from '../shared/demoData';
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
    dateEditor: createDatePickerEditor,
    ratingEditor: createRatingEditor,
    colorEditor: createColorPickerEditor,
    sliderEditor: createSliderEditor,
    tagsEditor: createTagsEditor,
  })
  : projectScenario.columns;

const container = document.getElementById('grid-container');
if (!container) {
  throw new Error('Grid container not found');
}

const rows = initialRows as ExampleRow[];

const grid = new OGrid<ExampleRow>(container, {
  ...(!isPremiumExample && projectScenario.serverSide ? { dataSource: projectScenario.dataSource! } : { data: rows }),
  columns: columns as ConstructorParameters<typeof OGrid<ExampleRow>>[1]['columns'],
  getRowId: (row) => row.id,
  entityLabelPlural: isPremiumExample ? 'products' : 'projects',
  pageSize: isPremiumExample ? 10 : 25,
  editable: isPremiumExample || !projectScenario.serverSide,
  cellSelection: true,
  cellReferences: isPremiumExample ? undefined : featureFlags.cellReferences,
  rowSelection: isPremiumExample ? undefined : projectScenario.rowSelection,
  formulas: isPremiumExample ? undefined : projectScenario.formulas,
  initialFormulas: isPremiumExample ? undefined : projectScenario.initialFormulas,
  statusBar: true,
  onCellValueChanged: (event) => handleCellValueChanged(rows, event),
});

(window as Record<string, unknown>).gridApi = grid.api;

if (location.hostname === 'localhost') {
  const api = grid.api;
  connectGridToBridge({
    gridId: 'js-demo',
    getData: () => api.getDisplayedRows(),
    getColumns: () => columns.map((column) => ({
      columnId: column.columnId,
      headerName: column.name ?? column.columnId,
      type: column.type,
    })),
    getSort: () => {
      const state = api.getColumnState();
      if (state.sort) {
        return [{ columnId: state.sort.field, direction: state.sort.direction }];
      }
      return [];
    },
    getFilters: () => {
      const state = api.getColumnState();
      return (state.filters ?? {}) as Record<string, unknown>;
    },
    api: {
      updateSort: (model) => {
        const first = model[0];
        api.applyColumnState({
          sort: first ? { field: first.columnId, direction: first.direction } : undefined,
        });
      },
      updateFilter: (columnId, value) => {
        const current = api.getColumnState().filters ?? {};
        api.setFilterModel({ ...current, [columnId]: value } as import('@alaarab/ogrid-core').IFilters);
      },
      clearFilters: () => api.clearFilters(),
    },
    onCellUpdate: (rowIndex, columnId, value) => {
      if (rows[rowIndex]) {
        (rows[rowIndex] as Record<string, unknown>)[columnId] = value;
      }
    },
  });
}

createThemeToggle();
