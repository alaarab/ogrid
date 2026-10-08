import { OGrid } from '../OGrid/OGrid';
import { createMergedCellsTests } from '@alaarab/ogrid-react/testing';

describe('OGrid merged cells and frozen rows', () => {
  createMergedCellsTests(OGrid);
});
