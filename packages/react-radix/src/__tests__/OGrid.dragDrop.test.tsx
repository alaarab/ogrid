import { DataGridTable } from '../DataGridTable/DataGridTable';
import { useCellDragSource } from '../index';
import { OGrid } from '../OGrid/OGrid';
import { createDragDropTests, createCellDragSourceTests } from '@alaarab/ogrid-react/testing';

describe('OGrid drag and drop', () => {
  createDragDropTests(OGrid, DataGridTable);
  createCellDragSourceTests(useCellDragSource);
});
