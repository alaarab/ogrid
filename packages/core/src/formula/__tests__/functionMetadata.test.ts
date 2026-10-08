import { createBuiltInFunctions } from '../functions';
import {
  getFunctionMetadata,
  getSignatureParts,
  listFunctions,
  parseFunctionSignature,
  resolveArgumentIndex,
} from '../functionMetadata';
import type { IFormulaFunction } from '../types';

describe('function metadata', () => {
  const registry = createBuiltInFunctions();

  it('every registered function has metadata whose arity matches the registry', () => {
    const mismatches: string[] = [];
    for (const [name, fn] of registry) {
      const meta = getFunctionMetadata(name);
      if (!meta) {
        mismatches.push(`${name}: missing`);
        continue;
      }
      const required = meta.args.filter((a) => !a.optional).length;
      if (required !== fn.minArgs) mismatches.push(`${name}: ${required} required args, registry minArgs ${fn.minArgs}`);
      if (fn.maxArgs < 0 && meta.repeatStart === undefined) mismatches.push(`${name}: variadic but no "..."`);
      if (fn.maxArgs >= 0 && (meta.repeatStart !== undefined || meta.args.length !== fn.maxArgs)) {
        mismatches.push(`${name}: ${meta.args.length} args, registry maxArgs ${fn.maxArgs}`);
      }
      if (!meta.description) mismatches.push(`${name}: no description`);
    }
    expect(mismatches).toEqual([]);
  });

  it('has no metadata for functions that are not registered', () => {
    const extra = listFunctions().map((m) => m.name).filter((n) => !registry.has(n));
    expect(extra).toEqual([]);
  });

  it('looks names up case-insensitively and lists them sorted', () => {
    expect(getFunctionMetadata('sumifs')?.signature).toBe(
      'SUMIFS(sum_range, criteria_range1, criteria1, [criteria_range2], [criteria2], ...)',
    );
    const names = listFunctions().map((m) => m.name);
    expect(names).toEqual([...names].sort());
    expect(getFunctionMetadata('NOPE')).toBeUndefined();
  });

  it('parses optional args and the repeating group', () => {
    expect(parseFunctionSignature('number1, [number2], ...')).toEqual({
      args: [{ name: 'number1', optional: false }, { name: 'number2', optional: true }],
      repeatStart: 1,
    });
    const ifs = parseFunctionSignature('logical_test1, value_if_true1, [logical_test2, value_if_true2], ...');
    expect(ifs.repeatStart).toBe(2);
    expect(ifs.args.map((a) => a.optional)).toEqual([false, false, true, true]);
    expect(parseFunctionSignature('')).toEqual({ args: [] });
  });

  it('folds argument indexes past the end into the repeating group', () => {
    const sumifs = getFunctionMetadata('SUMIFS')!;
    expect(resolveArgumentIndex(sumifs, 0)).toBe(0);
    expect(resolveArgumentIndex(sumifs, 4)).toBe(4);
    expect(resolveArgumentIndex(sumifs, 5)).toBe(3);
    expect(resolveArgumentIndex(sumifs, 6)).toBe(4);
    const round = getFunctionMetadata('ROUND')!;
    expect(resolveArgumentIndex(round, 2)).toBe(-1);
  });

  it('splits a signature into parts with the current argument active', () => {
    const parts = getSignatureParts(getFunctionMetadata('IF')!, 1);
    expect(parts.map((p) => p.text).join('')).toBe('IF(logical_test, value_if_true, [value_if_false])');
    expect(parts.filter((p) => p.active).map((p) => p.text)).toEqual(['value_if_true']);
  });

  it('includes custom functions, with fallback or supplied docs', () => {
    const custom: Record<string, IFormulaFunction> = {
      double: { minArgs: 1, maxArgs: 1, evaluate: () => 0 },
      Tax: { minArgs: 1, maxArgs: 2, evaluate: () => 0, description: 'Adds tax.', signature: 'amount, [rate]' },
      JOINALL: { minArgs: 1, maxArgs: -1, evaluate: () => 0 },
      SUM: { minArgs: 0, maxArgs: 0, evaluate: () => 0, description: 'Overridden.' },
    };
    expect(getFunctionMetadata('DOUBLE', custom)).toMatchObject({ category: 'Custom', signature: 'DOUBLE(value)' });
    expect(getFunctionMetadata('tax', custom)).toMatchObject({ description: 'Adds tax.', signature: 'TAX(amount, [rate])' });
    expect(getFunctionMetadata('JOINALL', custom)?.signature).toBe('JOINALL(value1, [value2], ...)');
    expect(getFunctionMetadata('SUM', custom)?.description).toBe('Overridden.');
    const list = listFunctions(custom);
    expect(list.filter((m) => m.name === 'SUM')).toHaveLength(1);
    expect(list.some((m) => m.name === 'DOUBLE')).toBe(true);
  });
});
