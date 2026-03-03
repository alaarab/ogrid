/**
 * Phase 4 tests: Named Ranges, Formula Auditing, Cross-Sheet References
 */
import { tokenize } from '../tokenizer';
import { parse } from '../parser';
import { FormulaEngine } from '../formulaEngine';
import { FormulaError } from '../types';
import type { IGridDataAccessor, CellKey } from '../types';
import { toCellKey, fromCellKey, formatAddress, adjustFormulaReferences } from '../cellAddressUtils';

// Helper: create a simple accessor from a 2D array
function createAccessor(data: unknown[][]): IGridDataAccessor {
  return {
    getCellValue: (col, row) => data[row]?.[col] ?? null,
    getRowCount: () => data.length,
    getColumnCount: () => (data[0]?.length ?? 0),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Feature 1: Named Ranges
// ═══════════════════════════════════════════════════════════════════════

describe('Named Ranges', () => {
  describe('tokenizer', () => {
    it('emits IDENTIFIER token for unknown names', () => {
      const tokens = tokenize('Revenue');
      expect(tokens[0].type).toBe('IDENTIFIER');
      expect(tokens[0].value).toBe('Revenue');
    });

    it('emits IDENTIFIER for multi-word names with underscores', () => {
      const tokens = tokenize('Total_Revenue');
      expect(tokens[0].type).toBe('IDENTIFIER');
      expect(tokens[0].value).toBe('Total_Revenue');
    });

    it('still emits FUNCTION when followed by paren', () => {
      const tokens = tokenize('SUM(');
      expect(tokens[0].type).toBe('FUNCTION');
      expect(tokens[0].value).toBe('SUM');
    });

    it('still emits CELL_REF for cell-like patterns', () => {
      const tokens = tokenize('A1');
      expect(tokens[0].type).toBe('CELL_REF');
    });

    it('still emits BOOLEAN for TRUE/FALSE', () => {
      const tokens = tokenize('TRUE');
      expect(tokens[0].type).toBe('BOOLEAN');
    });
  });

  describe('parser', () => {
    it('resolves named range to cell ref', () => {
      const namedRanges = new Map([['PRICE', 'A1']]);
      const tokens = tokenize('PRICE');
      const ast = parse(tokens, namedRanges);
      expect(ast.kind).toBe('cellRef');
      if (ast.kind === 'cellRef') {
        expect(ast.address.col).toBe(0);
        expect(ast.address.row).toBe(0);
      }
    });

    it('resolves named range to range ref', () => {
      const namedRanges = new Map([['DATA', 'A1:B5']]);
      const tokens = tokenize('DATA');
      const ast = parse(tokens, namedRanges);
      expect(ast.kind).toBe('range');
      if (ast.kind === 'range') {
        expect(ast.start.col).toBe(0);
        expect(ast.start.row).toBe(0);
        expect(ast.end.col).toBe(1);
        expect(ast.end.row).toBe(4);
      }
    });

    it('returns #NAME? error for unresolved identifier', () => {
      const tokens = tokenize('Unknown');
      const ast = parse(tokens);
      expect(ast.kind).toBe('error');
      if (ast.kind === 'error') {
        expect(ast.error.type).toBe('#NAME?');
      }
    });

    it('resolves named range case-insensitively', () => {
      const namedRanges = new Map([['REVENUE', 'A1:A10']]);
      const tokens = tokenize('revenue');
      const ast = parse(tokens, namedRanges);
      expect(ast.kind).toBe('range');
    });

    it('works inside a function call: SUM(Revenue)', () => {
      const namedRanges = new Map([['REVENUE', 'A1:A3']]);
      const tokens = tokenize('SUM(Revenue)');
      const ast = parse(tokens, namedRanges);
      expect(ast.kind).toBe('functionCall');
      if (ast.kind === 'functionCall') {
        expect(ast.name).toBe('SUM');
        expect(ast.args[0].kind).toBe('range');
      }
    });
  });

  describe('engine', () => {
    it('evaluates formula with named range', () => {
      const engine = new FormulaEngine({
        namedRanges: { Revenue: 'A1:A3' },
      });
      const accessor = createAccessor([[10], [20], [30]]);
      engine.setFormula(1, 0, '=SUM(Revenue)', accessor);
      expect(engine.getValue(1, 0)).toBe(60);
    });

    it('defineNamedRange adds a new named range', () => {
      const engine = new FormulaEngine();
      engine.defineNamedRange('Tax', 'B1');
      const accessor = createAccessor([[0, 0.1]]);
      engine.setFormula(2, 0, '=Tax*100', accessor);
      expect(engine.getValue(2, 0)).toBe(10);
    });

    it('removeNamedRange causes #NAME? on next set', () => {
      const engine = new FormulaEngine({
        namedRanges: { Price: 'A1' },
      });
      const accessor = createAccessor([[50]]);
      engine.setFormula(1, 0, '=Price', accessor);
      expect(engine.getValue(1, 0)).toBe(50);

      engine.removeNamedRange('Price');
      // Set a new formula that uses the removed name
      engine.setFormula(2, 0, '=Price', accessor);
      const val = engine.getValue(2, 0);
      expect(val).toBeInstanceOf(FormulaError);
      expect((val as FormulaError).type).toBe('#NAME?');
    });

    it('getNamedRanges returns current named ranges', () => {
      const engine = new FormulaEngine({
        namedRanges: { Revenue: 'A1:A3', Costs: 'B1:B3' },
      });
      const ranges = engine.getNamedRanges();
      expect(ranges.size).toBe(2);
      expect(ranges.get('REVENUE')).toBe('A1:A3');
      expect(ranges.get('COSTS')).toBe('B1:B3');
    });

    it('named range works with initial formulas via config', () => {
      const engine = new FormulaEngine({
        namedRanges: { Total: 'A1:A3' },
      });
      const accessor = createAccessor([[5], [10], [15]]);
      const result = engine.loadFormulas(
        [{ col: 1, row: 0, formula: '=SUM(Total)' }],
        accessor
      );
      expect(engine.getValue(1, 0)).toBe(30);
      expect(result.updatedCells.length).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feature 2: Formula Auditing
// ═══════════════════════════════════════════════════════════════════════

describe('Formula Auditing', () => {
  function createAuditEngine() {
    const engine = new FormulaEngine();
    const accessor = createAccessor([
      [10, 20, 0],
      [30, 40, 0],
      [0, 0, 0],
    ]);
    // C1 = A1 + B1
    engine.setFormula(2, 0, '=A1+B1', accessor);
    // C2 = A2 + B2
    engine.setFormula(2, 1, '=A2+B2', accessor);
    // A3 = SUM(C1:C2)  (transitive dependency)
    engine.setFormula(0, 2, '=SUM(C1:C2)', accessor);
    return { engine, accessor };
  }

  describe('getPrecedents', () => {
    it('returns direct precedents', () => {
      const { engine } = createAuditEngine();
      const precs = engine.getPrecedents(2, 0); // C1 = A1+B1
      const keys = precs.map(p => p.cellKey);
      expect(keys).toContain(toCellKey(0, 0)); // A1
      expect(keys).toContain(toCellKey(1, 0)); // B1
    });

    it('returns transitive precedents', () => {
      const { engine } = createAuditEngine();
      const precs = engine.getPrecedents(0, 2); // A3 = SUM(C1:C2)
      const keys = precs.map(p => p.cellKey);
      // Direct: C1, C2
      expect(keys).toContain(toCellKey(2, 0));
      expect(keys).toContain(toCellKey(2, 1));
      // Transitive: A1, B1, A2, B2
      expect(keys).toContain(toCellKey(0, 0));
      expect(keys).toContain(toCellKey(1, 0));
      expect(keys).toContain(toCellKey(0, 1));
      expect(keys).toContain(toCellKey(1, 1));
    });

    it('returns empty for non-formula cell', () => {
      const { engine } = createAuditEngine();
      const precs = engine.getPrecedents(0, 0); // A1  -  data cell
      expect(precs).toEqual([]);
    });

    it('includes formula strings in entries', () => {
      const { engine } = createAuditEngine();
      const precs = engine.getPrecedents(0, 2);
      const c1Entry = precs.find(p => p.col === 2 && p.row === 0);
      expect(c1Entry?.formula).toBe('=A1+B1');
    });
  });

  describe('getDependents', () => {
    it('returns direct dependents', () => {
      const { engine } = createAuditEngine();
      const deps = engine.getDependents(0, 0); // A1
      const keys = deps.map(d => d.cellKey);
      expect(keys).toContain(toCellKey(2, 0)); // C1 = A1+B1
    });

    it('returns transitive dependents', () => {
      const { engine } = createAuditEngine();
      const deps = engine.getDependents(0, 0); // A1
      const keys = deps.map(d => d.cellKey);
      // C1 depends on A1
      expect(keys).toContain(toCellKey(2, 0));
      // A3 depends on C1 (transitive)
      expect(keys).toContain(toCellKey(0, 2));
    });

    it('returns empty for cell with no dependents', () => {
      const { engine } = createAuditEngine();
      const deps = engine.getDependents(0, 2); // A3 has no dependents
      expect(deps).toEqual([]);
    });
  });

  describe('getAuditTrail', () => {
    it('returns target + precedents + dependents', () => {
      const { engine } = createAuditEngine();
      const trail = engine.getAuditTrail(2, 0); // C1
      expect(trail.target.col).toBe(2);
      expect(trail.target.row).toBe(0);
      expect(trail.target.formula).toBe('=A1+B1');
      expect(trail.target.value).toBe(30); // 10+20
      // Precedents: A1, B1
      expect(trail.precedents.length).toBe(2);
      // Dependents: A3
      expect(trail.dependents.length).toBe(1);
      expect(trail.dependents[0].cellKey).toBe(toCellKey(0, 2));
    });

    it('returns correct value for target', () => {
      const { engine } = createAuditEngine();
      const trail = engine.getAuditTrail(0, 2); // A3 = SUM(C1:C2)
      expect(trail.target.value).toBe(100); // (10+20) + (30+40)
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feature 3: Cross-Sheet References
// ═══════════════════════════════════════════════════════════════════════

describe('Cross-Sheet References', () => {
  describe('tokenizer', () => {
    it('tokenizes Sheet2!A1', () => {
      const tokens = tokenize('Sheet2!A1');
      expect(tokens[0].type).toBe('SHEET_REF');
      expect(tokens[0].value).toBe('Sheet2');
      expect(tokens[1].type).toBe('CELL_REF');
      expect(tokens[1].value).toBe('A1');
    });

    it('tokenizes quoted sheet name: \'My Sheet\'!A1', () => {
      const tokens = tokenize("'My Sheet'!A1");
      expect(tokens[0].type).toBe('SHEET_REF');
      expect(tokens[0].value).toBe('My Sheet');
      expect(tokens[1].type).toBe('CELL_REF');
      expect(tokens[1].value).toBe('A1');
    });

    it('tokenizes sheet ref with range', () => {
      const tokens = tokenize('Sheet2!A1:B3');
      expect(tokens[0].type).toBe('SHEET_REF');
      expect(tokens[0].value).toBe('Sheet2');
      expect(tokens[1].type).toBe('CELL_REF');
      expect(tokens[2].type).toBe('COLON');
      expect(tokens[3].type).toBe('CELL_REF');
    });

    it('tokenizes sheet ref in expression', () => {
      const tokens = tokenize('Sheet2!A1+B1');
      expect(tokens[0].type).toBe('SHEET_REF');
      expect(tokens[1].type).toBe('CELL_REF');
      expect(tokens[2].type).toBe('PLUS');
      expect(tokens[3].type).toBe('CELL_REF');
    });

    it('throws for invalid quoted sheet ref (missing !)', () => {
      expect(() => tokenize("'Sheet'+1")).toThrow(FormulaError);
    });
  });

  describe('parser', () => {
    it('parses sheet-qualified cell ref', () => {
      const tokens = tokenize('Sheet2!A1');
      const ast = parse(tokens);
      expect(ast.kind).toBe('cellRef');
      if (ast.kind === 'cellRef') {
        expect(ast.address.sheet).toBe('Sheet2');
        expect(ast.address.col).toBe(0);
        expect(ast.address.row).toBe(0);
      }
    });

    it('parses quoted sheet-qualified cell ref', () => {
      const tokens = tokenize("'Data Sheet'!B5");
      const ast = parse(tokens);
      expect(ast.kind).toBe('cellRef');
      if (ast.kind === 'cellRef') {
        expect(ast.address.sheet).toBe('Data Sheet');
        expect(ast.address.col).toBe(1);
        expect(ast.address.row).toBe(4);
      }
    });

    it('parses sheet-qualified range', () => {
      const tokens = tokenize('Sheet2!A1:B3');
      const ast = parse(tokens);
      expect(ast.kind).toBe('range');
      if (ast.kind === 'range') {
        expect(ast.start.sheet).toBe('Sheet2');
        expect(ast.end.sheet).toBe('Sheet2');
        expect(ast.start.col).toBe(0);
        expect(ast.end.col).toBe(1);
      }
    });

    it('parses sheet ref inside function', () => {
      const tokens = tokenize('SUM(Sheet2!A1:A3)');
      const ast = parse(tokens);
      expect(ast.kind).toBe('functionCall');
      if (ast.kind === 'functionCall') {
        expect(ast.args[0].kind).toBe('range');
      }
    });
  });

  describe('cellAddressUtils', () => {
    it('toCellKey with sheet', () => {
      const key = toCellKey(0, 0, 'Sheet2');
      expect(key).toBe('Sheet2:0,0');
    });

    it('fromCellKey with sheet', () => {
      const result = fromCellKey('Sheet2:0,0');
      expect(result.col).toBe(0);
      expect(result.row).toBe(0);
      expect(result.sheet).toBe('Sheet2');
    });

    it('toCellKey without sheet (unchanged)', () => {
      const key = toCellKey(3, 5);
      expect(key).toBe('3,5');
    });

    it('fromCellKey without sheet (unchanged)', () => {
      const result = fromCellKey('3,5');
      expect(result.col).toBe(3);
      expect(result.row).toBe(5);
      expect(result.sheet).toBeUndefined();
    });

    it('round-trips with sheet', () => {
      const key = toCellKey(2, 7, 'Sales');
      const parsed = fromCellKey(key);
      expect(parsed.col).toBe(2);
      expect(parsed.row).toBe(7);
      expect(parsed.sheet).toBe('Sales');
    });

    it('formatAddress includes sheet name', () => {
      const addr = { col: 0, row: 0, absCol: false, absRow: false, sheet: 'Sheet2' };
      expect(formatAddress(addr)).toBe('Sheet2!A1');
    });

    it('formatAddress quotes sheet name with spaces', () => {
      const addr = { col: 1, row: 2, absCol: false, absRow: false, sheet: 'My Sheet' };
      expect(formatAddress(addr)).toBe("'My Sheet'!B3");
    });

    it('adjustFormulaReferences preserves sheet prefix', () => {
      const result = adjustFormulaReferences('=Sheet2!A1+B1', 0, 1);
      expect(result).toBe('=Sheet2!A2+B2');
    });

    it('adjustFormulaReferences preserves quoted sheet prefix', () => {
      const result = adjustFormulaReferences("='My Sheet'!A1", 1, 0);
      expect(result).toBe("='My Sheet'!B1");
    });
  });

  describe('engine', () => {
    it('evaluates cross-sheet formula', () => {
      const engine = new FormulaEngine();
      const mainAccessor = createAccessor([[100]]);
      const sheet2Accessor = createAccessor([[42]]);
      engine.registerSheet('Sheet2', sheet2Accessor);

      engine.setFormula(1, 0, '=Sheet2!A1', mainAccessor);
      expect(engine.getValue(1, 0)).toBe(42);
    });

    it('evaluates cross-sheet SUM', () => {
      const engine = new FormulaEngine();
      const mainAccessor = createAccessor([[0]]);
      const sheet2Accessor = createAccessor([[10], [20], [30]]);
      engine.registerSheet('Sheet2', sheet2Accessor);

      engine.setFormula(0, 0, '=SUM(Sheet2!A1:A3)', mainAccessor);
      expect(engine.getValue(0, 0)).toBe(60);
    });

    it('returns #REF! for unregistered sheet', () => {
      const engine = new FormulaEngine();
      const accessor = createAccessor([[0]]);

      engine.setFormula(0, 0, '=UnknownSheet!A1', accessor);
      const val = engine.getValue(0, 0);
      expect(val).toBeInstanceOf(FormulaError);
      expect((val as FormulaError).type).toBe('#REF!');
    });

    it('unregisterSheet makes formulas return #REF!', () => {
      const engine = new FormulaEngine();
      const mainAccessor = createAccessor([[0]]);
      const sheet2Accessor = createAccessor([[42]]);
      engine.registerSheet('Sheet2', sheet2Accessor);

      engine.setFormula(0, 0, '=Sheet2!A1', mainAccessor);
      expect(engine.getValue(0, 0)).toBe(42);

      engine.unregisterSheet('Sheet2');
      // Recalculate
      const result = engine.setFormula(0, 0, '=Sheet2!A1', mainAccessor);
      const val = engine.getValue(0, 0);
      expect(val).toBeInstanceOf(FormulaError);
    });

    it('cross-sheet + local ref in expression', () => {
      const engine = new FormulaEngine();
      const mainAccessor = createAccessor([[10]]);
      const sheet2Accessor = createAccessor([[5]]);
      engine.registerSheet('Sheet2', sheet2Accessor);

      engine.setFormula(1, 0, '=A1+Sheet2!A1', mainAccessor);
      expect(engine.getValue(1, 0)).toBe(15);
    });

    it('quoted sheet name works in engine', () => {
      const engine = new FormulaEngine();
      const mainAccessor = createAccessor([[0]]);
      const dataAccessor = createAccessor([[99]]);
      engine.registerSheet('Sales Data', dataAccessor);

      engine.setFormula(0, 0, "='Sales Data'!A1", mainAccessor);
      expect(engine.getValue(0, 0)).toBe(99);
    });
  });
});
