/**
 * Angular PrimeNG UI package tests using shared test factories.
 * These test the Angular PrimeNG component classes through
 * the signal-based API (no DOM rendering required).
 */
import {
  createOGridTests,
  createDataGridTableTests,
  createColumnHeaderFilterTests,
  createColumnChooserTests,
  createPaginationControlsTests,
  createSpreadsheetTests,
  createColumnGroupTests,
  createSideBarTests,
} from '@alaarab/ogrid-angular/testing';
import { OGridComponent } from '../ogrid/ogrid.component';
import { DataGridTableComponent } from '../datagrid-table/datagrid-table.component';
import { ColumnHeaderFilterComponent } from '../column-header-filter/column-header-filter.component';
import { ColumnChooserComponent } from '../column-chooser/column-chooser.component';
import { PaginationControlsComponent } from '../pagination-controls/pagination-controls.component';

describe('OGridComponent', () => {
  createOGridTests(OGridComponent);
});

describe('DataGridTableComponent', () => {
  createDataGridTableTests(DataGridTableComponent);
});

describe('ColumnHeaderFilterComponent', () => {
  createColumnHeaderFilterTests(ColumnHeaderFilterComponent);
});

describe('ColumnChooserComponent', () => {
  createColumnChooserTests(ColumnChooserComponent);
});

describe('PaginationControlsComponent', () => {
  createPaginationControlsTests(PaginationControlsComponent);
});

describe('Spreadsheet Features', () => {
  createSpreadsheetTests(DataGridTableComponent);
});

describe('Column Groups', () => {
  createColumnGroupTests(DataGridTableComponent);
});

describe('SideBar', () => {
  createSideBarTests(OGridComponent);
});
