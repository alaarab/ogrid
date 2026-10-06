import { describe, it, expect, mock } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useOGridPageClamp } from '../useOGridPageClamp';
import { useOGridSheetCoordinates } from '../useOGridSheetCoordinates';
import type { UseOGridSheetCoordinatesParams } from '../useOGridSheetCoordinates';
import { useOGridFormulas } from '../useOGridFormulas';
import type { PageClampInput } from '../ogridDerivations';

type Row = { id: string; v: number };
const rows: Row[] = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
const getRowId = (r: Row) => r.id;

describe('useOGridPageClamp', () => {
  const base: PageClampInput = { page: 4, pageSize: 10, totalCount: 15, controlled: false, unpaged: false };

  it('snaps back to the last page once, after render', () => {
    const setPage = mock(() => {});
    const { rerender } = renderHook((p: PageClampInput) => useOGridPageClamp(p, setPage), { initialProps: base });
    expect(setPage).toHaveBeenCalledTimes(1);
    expect(setPage).toHaveBeenCalledWith(2);
    rerender({ ...base });
    expect(setPage).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a page in range', () => {
    const setPage = mock(() => {});
    renderHook(() => useOGridPageClamp({ ...base, page: 2 }, setPage));
    expect(setPage).not.toHaveBeenCalled();
  });
});

describe('useOGridSheetCoordinates', () => {
  const params: UseOGridSheetCoordinatesParams<Row> = {
    spreadsheetMode: true, isServerSide: false, displayData: rows, displayItems: [rows[1] as Row],
    windowed: null, page: 1, pageSize: 10, getRowId,
  };

  it('keeps sheetItems and formulaRowMap identity across renders with the same inputs', () => {
    const { result, rerender } = renderHook((p: UseOGridSheetCoordinatesParams<Row>) => useOGridSheetCoordinates(p), { initialProps: params });
    const first = result.current;
    rerender({ ...params });
    expect(result.current.sheetItems).toBe(first.sheetItems);
    expect(result.current.formulaRowMap).toBe(first.formulaRowMap);
  });

  it('maps displayed rows to their index in the full data', () => {
    const { result } = renderHook(() => useOGridSheetCoordinates(params));
    expect(result.current.sheetItems).toBe(rows);
    expect(result.current.formulaRowMap?.toSheetRow(0)).toBe(1);
  });

  it('has no row map outside spreadsheet mode', () => {
    const { result } = renderHook(() => useOGridSheetCoordinates({ ...params, spreadsheetMode: false }));
    expect(result.current.formulaRowMap).toBeUndefined();
  });
});

describe('useOGridFormulas', () => {
  const columns = [{ columnId: 'v', name: 'V' }];
  const base = { sheetItems: rows, columns, formulaRowMap: undefined, hasHostUndo: false };

  it('exposes no engine functions or writer ref while formulas are off', () => {
    const { result } = renderHook(() => useOGridFormulas<Row>({ ...base }));
    const p = result.current.dgFormulaProps;
    expect(p.getFormulaValue).toBeUndefined();
    expect(p.setFormula).toBeUndefined();
    expect(p.formulaCellWriterRef).toBeUndefined();
    expect(result.current.formulaBarEl).toBeUndefined();
  });

  it('wires the engine and keeps dgFormulaProps stable across renders', () => {
    const { result, rerender } = renderHook(
      (p: typeof base) => useOGridFormulas<Row>({ ...p, formulas: true }),
      { initialProps: base },
    );
    const first = result.current.dgFormulaProps;
    expect(first.getFormulaValue).toBeDefined();
    expect(first.formulaCellWriterRef).toBeDefined();
    expect(result.current.formulaBarEl).toBeDefined();
    rerender({ ...base });
    expect(result.current.dgFormulaProps).toBe(first);
  });

  it('follows formula text in the data when the host owns undo', () => {
    const data = [{ id: 'a', v: '=1+2' }, { id: 'b', v: 2 }] as unknown as Row[];
    const host = renderHook(() => useOGridFormulas<Row>({ ...base, sheetItems: data, formulas: true, hasHostUndo: true }));
    expect(host.result.current.dgFormulaProps.getFormula?.(0, 0)).toBe('=1+2');
    const internal = renderHook(() => useOGridFormulas<Row>({ ...base, sheetItems: data, formulas: true, hasHostUndo: false }));
    expect(internal.result.current.dgFormulaProps.getFormula?.(0, 0)).toBeUndefined();
  });
});
