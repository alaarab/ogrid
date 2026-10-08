import { OGrid } from '../OGrid/OGrid';
import { createFreezeTests } from '@alaarab/ogrid-react/testing';

describe('OGrid freeze panes', () => {
  createFreezeTests(OGrid);
});
