import { DataGridTable } from '../DataGridTable/DataGridTable';
import { OGrid } from '../OGrid/OGrid';
import { createRowMemoTests, createRowMemoOGridTests } from '@alaarab/ogrid-react/testing';

describe('DataGridTable row memoization', () => {
  createRowMemoTests(DataGridTable);
  createRowMemoOGridTests(OGrid);
});
