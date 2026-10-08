import { OGrid } from '../OGrid/OGrid';
import { createFormulaAssistTests } from '@alaarab/ogrid-react/testing';

describe('OGrid formula autocomplete and argument hints', () => {
  createFormulaAssistTests(OGrid);
});
