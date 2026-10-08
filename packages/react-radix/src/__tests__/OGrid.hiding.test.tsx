import { OGrid } from '../OGrid/OGrid';
import { createHidingTests } from '@alaarab/ogrid-react/testing';

describe('OGrid hide/unhide rows and columns', () => {
  createHidingTests(OGrid);
});
