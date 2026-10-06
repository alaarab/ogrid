import { describe, it, expect, mock } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useOGridPageClamp } from '../useOGridPageClamp';
import { useOGridSheetCoordinates } from '../useOGridSheetCoordinates';
import { useOGridFormulas } from '../useOGridFormulas';

type Row = { id: string; v: number };
const rows: Row[] = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
const getRowId = (r: Row) => r.id;

describe('useOGridPageClamp', () => {
  it('snaps to the target once, after render, and not again while it holds', () => {
    const setPage = mock(() => {});
    const { rerender } = renderHook((t: number | null) => useOGridPageClamp(t, setPage), { initialProps: 2 as number | null });
    expect(setPage).toHaveBeenCalledTimes(1);
    expect(setPage).toHaveBeenCalledWith(2);
    rerender(2);
    expect(setPage).toHaveBeenCalledTimes(1);
    rerender(null);
    rerender(1);
    expect(setPage).toHaveBeenLastCalledWith(1);
  });

  it('does nothing without a target', () => {
    const setPage = mock(() => {});
    renderHook(() => useOGridPageClamp(null, setPage));
    expect(setPage).not.toHaveBeenCalled();
  });
});

describe('useOGridSheetCoordinates', () => {
  type Args = Parameters<typeof useOGridSheetCoordinates<Row>>;
  const args = (over: Partial<{ spreadsheetMode: boolean }> = {}): Args => [
    over.spreadsheetMode ?? true, false, rows, { displayItems: [rows[1] as Row], windowed: null }, { page: 1, pageSize: 10 }, getRowId,
  ];

  it('keeps sheetItems and formulaRowMap identity across renders with the same inputs', () => {
    const first = args();
    const { result, rerender } = renderHook((a: Args) => useOGridSheetCoordinates(...a), { initialProps: first });
    const before = result.current;
    rerender([first[0], first[1], first[2], { ...first[3] }, { page: 1, pageSize: 10 }, first[5]]);
    expect(result.current.sheetItems).toBe(before.sheetItems);
    expect(result.current.formulaRowMap).toBe(before.formulaRowMap);
  });

  it('maps displayed rows to their index in the full data', () => {
    const { result } = renderHook(() => useOGridSheetCoordinates(...args()));
    expect(result.current.sheetItems).toBe(rows);
    expect(result.current.formulaRowMap?.toSheetRow(0)).toBe(1);
  });

  it('has no row map outside spreadsheet mode', () => {
    const { result } = renderHook(() => useOGridSheetCoordinates(...args({ spreadsheetMode: false })));
    expect(result.current.formulaRowMap).toBeUndefined();
  });
});

describe('useOGridFormulas', () => {
  const columns = [{ columnId: 'v', name: 'V' }];

  it('exposes no engine functions or writer ref while formulas are off', () => {
    const { result } = renderHook(() => useOGridFormulas<Row>({}, rows, columns, undefined));
    const p = result.current.dgFormulaProps;
    expect(p.getFormulaValue).toBeUndefined();
    expect(p.setFormula).toBeUndefined();
    expect(p.formulaCellWriterRef).toBeUndefined();
    expect(result.current.formulaBarEl).toBeUndefined();
  });

  it('wires the engine and keeps dgFormulaProps stable across renders', () => {
    const { result, rerender } = renderHook(
      (p: { formulas: boolean }) => useOGridFormulas<Row>({ ...p }, rows, columns, undefined),
      { initialProps: { formulas: true } },
    );
    const first = result.current.dgFormulaProps;
    expect(first.getFormulaValue).toBeDefined();
    expect(first.formulaCellWriterRef).toBeDefined();
    expect(result.current.formulaBarEl).toBeDefined();
    rerender({ formulas: true });
    expect(result.current.dgFormulaProps).toBe(first);
  });

  it('follows formula text in the data when the host owns undo (onUndo)', () => {
    const data = [{ id: 'a', v: '=1+2' }, { id: 'b', v: 2 }] as unknown as Row[];
    const host = renderHook(() => useOGridFormulas<Row>({ formulas: true, onUndo: () => {} }, data, columns, undefined));
    expect(host.result.current.dgFormulaProps.getFormula?.(0, 0)).toBe('=1+2');
    const internal = renderHook(() => useOGridFormulas<Row>({ formulas: true }, data, columns, undefined));
    expect(internal.result.current.dgFormulaProps.getFormula?.(0, 0)).toBeUndefined();
  });
});
