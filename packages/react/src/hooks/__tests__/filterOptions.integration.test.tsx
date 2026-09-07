import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { getHeaderFilterConfig } from '@alaarab/ogrid-core';
import { useOGrid } from '../useOGrid';
import { SideBar } from '../../components/SideBar';
import type { IColumnDef, IDataSource, IFetchParams } from '../../types';

type Row = { id: number; active: boolean };
const data: Row[] = [{ id: 1, active: true }, { id: 2, active: false }];
const options = [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }];
const columns: IColumnDef<Row>[] = [{
  columnId: 'active', name: 'Status',
  filterable: { type: 'multiSelect', filterField: 'is_active', options },
}];
const getRowId = (row: Row) => row.id;

it('uses static labels in header and sidebar, and filters boolean client data by value', () => {
  const { result } = renderHook(() => useOGrid({ columns, data, getRowId, sideBar: { panels: ['filters'], defaultPanel: 'filters' } }));
  const grid = result.current.dataGridProps;
  const config = getHeaderFilterConfig(columns[0]!, {
    ...grid, sortDirection: 'asc', filterOptions: { is_active: ['ignored'] },
    loadingFilterOptions: { is_active: true },
  });
  expect(config.options).toEqual(options);
  expect(config.isLoadingOptions).toBe(false);
  render(<SideBar {...result.current.layout.sideBarProps!} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Inactive' }));
  expect(result.current.dataGridProps.filters).toEqual({ is_active: { type: 'multiSelect', value: ['false'] } });
  expect(result.current.dataGridProps.items).toEqual([data[1]!]);
});

it('sends raw values to the server and does not fetch options for static columns', async () => {
  const fetchPage = jest.fn(async (_params: IFetchParams) => ({ items: data, totalCount: data.length }));
  const fetchFilterOptions = jest.fn(async () => ['ignored']);
  const dataSource: IDataSource<Row> = { fetchPage, fetchFilterOptions };
  const { result } = renderHook(() => useOGrid({ columns, dataSource, getRowId }));
  await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  expect(result.current.dataGridProps.filterOptions.is_active).toEqual(options);
  expect(fetchFilterOptions).not.toHaveBeenCalled();
  act(() => result.current.dataGridProps.onFilterChange('is_active', { type: 'multiSelect', value: ['true'] }));
  await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({
    filters: { is_active: { type: 'multiSelect', value: ['true'] } },
  })));
});

it('accepts value/label options fetched from the data source', async () => {
  const dynamicColumns: IColumnDef<Row>[] = [{ columnId: 'active', name: 'Status', filterable: { type: 'multiSelect' } }];
  const dataSource: IDataSource<Row> = {
    fetchPage: async () => ({ items: data, totalCount: data.length }),
    fetchFilterOptions: async () => options,
  };
  const { result } = renderHook(() => useOGrid({ columns: dynamicColumns, dataSource, getRowId }));
  await waitFor(() => expect(result.current.dataGridProps.filterOptions.active).toEqual(options));
});
