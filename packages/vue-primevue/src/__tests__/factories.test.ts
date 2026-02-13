/**
 * Vue PrimeVue UI package tests using shared test factories.
 * These test the composable-based API through Vue's reactivity system.
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
} from '@alaarab/ogrid-vue/testing';

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
