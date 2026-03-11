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
    dateEditor: createDatePickerEditor,
    ratingEditor: createRatingEditor,
    colorEditor: createColorPickerEditor,
    sliderEditor: createSliderEditor,
    tagsEditor: createTagsEditor,
  })
  : projectScenario.columns);

const container = document.getElementById('grid-container');
if (!container) {
  throw new Error('Grid container not found');
}

const rows = initialRows;

const grid = new OGrid<ExampleRow>(container, {
  ...(!isPremiumExample && projectScenario.serverSide ? { dataSource: coerceExampleDataSource(projectScenario.dataSource!) } : { data: rows }),
  columns: columns as unknown as ConstructorParameters<typeof OGrid<ExampleRow>>[1]['columns'],
  getRowId: (row) => row.id,
  entityLabelPlural: isPremiumExample ? 'products' : 'projects',
  pageSize: isPremiumExample ? 10 : projectScenario.defaultPageSize,
  editable: isPremiumExample || !projectScenario.serverSide,
  cellSelection: true,
  cellReferences: isPremiumExample ? undefined : projectScenario.cellReferences,
  rowSelection: isPremiumExample ? undefined : projectScenario.rowSelection,
  formulas: isPremiumExample ? undefined : projectScenario.formulas,
  initialFormulas: isPremiumExample ? undefined : projectScenario.initialFormulas,
  sideBar: isPremiumExample ? undefined : projectScenario.sideBar,
  fullScreen: isPremiumExample ? undefined : projectScenario.fullScreen,
  responsiveColumns: isPremiumExample ? undefined : projectScenario.responsiveColumns,
  density: isPremiumExample ? undefined : projectScenario.density,
  statusBar: true,
  onCellValueChanged: (event) => handleCellValueChanged(rows, event),
});

(window as unknown as Record<string, unknown>).gridApi = grid.api;

if (location.hostname === 'localhost') {
  const api = grid.api;
  connectGridToBridge({
    gridId: 'js-demo',
    getData: () => api.getDisplayedRows(),
    getColumns: () => columns.flatMap((column) => (
      'columnId' in column
        ? [{ columnId: column.columnId, headerName: column.name ?? column.columnId, type: column.type }]
        : []
    )),
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
