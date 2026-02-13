/**
 * Smoke test: verifies all Vue test factories run correctly in the base vue package.
 * UI packages (vue-vuetify, vue-primevue, vue-radix) will import and run these same factories.
 */
import {
  createOGridTests,
  createDataGridTableTests,
  createSpreadsheetTests,
  createColumnHeaderFilterTests,
  createColumnChooserTests,
  createPaginationControlsTests,
  createColumnGroupTests,
  createSideBarTests,
} from '../testing';

describe('OGrid', () => {
  createOGridTests();
});

describe('DataGridTable', () => {
  createDataGridTableTests();
});

describe('Spreadsheet', () => {
  createSpreadsheetTests();
});

describe('ColumnHeaderFilter', () => {
  createColumnHeaderFilterTests();
});

describe('ColumnChooser', () => {
  createColumnChooserTests();
});

describe('PaginationControls', () => {
  createPaginationControlsTests();
});

describe('ColumnGroups', () => {
  createColumnGroupTests();
});

describe('SideBar', () => {
  createSideBarTests();
});
