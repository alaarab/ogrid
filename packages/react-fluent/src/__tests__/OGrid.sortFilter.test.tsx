import { OGrid } from '../OGrid/OGrid';
import { createSortFilterTests } from '@alaarab/ogrid-react/testing';

describe('OGrid multi-level sort and condition filters', () => {
  createSortFilterTests(OGrid);
});
