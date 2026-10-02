import { createRef } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useOGrid } from '../useOGrid';
import type { IDataSource, IOGridApi, IColumnDef } from '../../types';

type Row = { id: number; a: number; b: number };
const columns: IColumnDef<Row>[] = [{ columnId: 'a', name: 'A' }, { columnId: 'b', name: 'B' }];
const getRowId = (item: Row) => item.id;

describe('windowed formula coordinates and API rows', () => {
  it('reads sparse absolute rows, recalculates as windows load and reload, and selects only loaded records', async () => {
    const count = 1_000_000;
    let value = 7;
    const dataSource: IDataSource<Row> = {
      getRowCount: async () => count,
      getRows: async ({ start, end }) => ({
        items: Array.from({ length: end - start }, (_, offset) => ({ id: start + offset, a: value, b: 0 })),
        totalCount: count,
      }),
    };
    const initialFormulas = [
      { col: 1, row: 300, formula: '=A301*2' },
      { col: 1, row: 301, formula: '=A301+A501' },
    ];
    const onSelectionChange = jest.fn();
    const apiRef = createRef<IOGridApi<Row>>();
    const props = { columns, getRowId, dataSource, formulas: true, initialFormulas, onSelectionChange };
    const { result } = renderHook(() => useOGrid(props, apiRef));
    await waitFor(() => expect(result.current.dataGridProps.windowed?.rowCount).toBe(count));
    expect(result.current.dataGridProps.getFormulaValue?.(1, 300)).toBe(0);
    expect(result.current.dataGridProps.formulaRowMap?.toSheetRow(300)).toBe(300);
    expect(result.current.dataGridProps.formulaRowMap?.toDisplayRow(999_999)).toBe(999_999);
    expect(result.current.dataGridProps.formulaRowMap?.toSheetRow(count)).toBe(-1);
    act(() => result.current.dataGridProps.windowed?.requestWindow(300, 302));
    await waitFor(() => expect(result.current.dataGridProps.getFormulaValue?.(1, 300)).toBe(14));
    expect(result.current.dataGridProps.getFormulaValue?.(1, 301)).toBe(7);
    const loaded = result.current.dataGridProps.windowed?.loadedRows;
    expect(loaded?.length).toBe(count);
    expect(Object.keys(loaded ?? {})).toHaveLength(200);
    expect(loaded?.[0]).toBeUndefined();
    expect(apiRef.current?.getDisplayedRows().map((item) => item.id)).toEqual(Array.from({ length: 200 }, (_, i) => 200 + i));
    act(() => apiRef.current?.selectAll());
    expect(apiRef.current?.getSelectedRows()).toEqual(Array.from({ length: 200 }, (_, i) => 200 + i));
    expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ selectedItems: apiRef.current?.getDisplayedRows() }));
    act(() => apiRef.current?.setSelectedRows([301, 500]));
    expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ selectedItems: [loaded?.[301]] }));
    act(() => result.current.dataGridProps.windowed?.requestWindow(500, 501));
    await waitFor(() => expect(result.current.dataGridProps.getFormulaValue?.(1, 301)).toBe(14));
    expect(apiRef.current?.getDisplayedRows()).toHaveLength(400);
    value = 9;
    act(() => apiRef.current?.refreshData());
    await waitFor(() => expect(result.current.dataGridProps.windowed?.loadedRows?.[500]?.a).toBe(9));
    act(() => result.current.dataGridProps.windowed?.requestWindow(300, 302));
    await waitFor(() => expect(result.current.dataGridProps.getFormulaValue?.(1, 300)).toBe(18));
    expect(result.current.dataGridProps.getFormulaValue?.(1, 301)).toBe(18);
  });
});
