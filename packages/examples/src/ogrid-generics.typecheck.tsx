// Compile-only public API regression, also used with isolated React 17/18 types.
import { createRef, type ComponentType, type RefAttributes } from 'react';
import { createOGrid, type IColumnDef, type IOGridApi, type IOGridProps } from '@alaarab/ogrid-react';
import {
  OGrid as RadixOGrid,
  DataGridTable as RadixDataGridTable,
  ColumnChooser,
  PaginationControls,
} from '@alaarab/ogrid-react-radix';
import { OGrid as FluentOGrid, DataGridTable as FluentDataGridTable } from '@alaarab/ogrid-react-fluent';

interface Employee { id: string; salary: number }
const employees: Employee[] = [{ id: '1', salary: 90000 }];
const columns: IColumnDef<Employee>[] = [{ columnId: 'salary', name: 'Salary' }];

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
function expectType<T extends true>(_value: T): void {}

const CustomOGrid = createOGrid({ DataGridTable: RadixDataGridTable, ColumnChooser, PaginationControls });

export function checkGenericGridComponents(): void {
  const gridRef = createRef<IOGridApi<Employee>>();
  for (const Grid of [RadixOGrid, FluentOGrid, CustomOGrid]) {
    // Existing consumers can still accept a component specialized for one row type.
    const ConsumerGrid: ComponentType<IOGridProps<Employee> & RefAttributes<IOGridApi<Employee>>> = Grid;
    <ConsumerGrid ref={gridRef} columns={columns} data={employees} getRowId={employee => employee.id} />;
    <Grid<Employee>
      ref={gridRef}
      columns={columns}
      data={employees}
      getRowId={employee => {
        expectType<Equal<typeof employee, Employee>>(true);
        return employee.id;
      }}
      onCellValueChanged={({ item }) => {
        expectType<Equal<typeof item, Employee>>(true);
      }}
    />;

    // Empty columns and an unannotated ref ensure the row type comes from data.
    <Grid
      columns={[]}
      data={employees}
      ref={api => {
        expectType<Equal<typeof api, IOGridApi<Employee> | null>>(true);
        api?.setRowData(employees);
        // @ts-expect-error The API accepts Employee rows only.
        api?.setRowData([{ id: 'wrong', salary: 'not a number' }]);
      }}
      getRowId={employee => {
        expectType<Equal<typeof employee, Employee>>(true);
        return employee.id;
      }}
      onCellValueChanged={({ item }) => {
        expectType<Equal<typeof item, Employee>>(true);
      }}
    />;

    // @ts-expect-error editable must be a boolean.
    <Grid<Employee> columns={columns} data={employees} getRowId={employee => employee.id} editable="yes" />;
    // @ts-expect-error The ref must expose IOGridApi<Employee>.
    <Grid<Employee> columns={columns} data={employees} getRowId={employee => employee.id} ref={createRef<IOGridApi<string>>()} />;
    // @ts-expect-error Row callbacks must accept Employee.
    <Grid<Employee> columns={columns} data={employees} getRowId={(employee: { id: number }) => employee.id} />;

    // The wrapper's existing React static properties remain available.
    expectType<Equal<typeof Grid.displayName, string | undefined>>(true);
    expectType<Equal<typeof Grid.$$typeof, symbol>>(true);
  }

  const tableProps = {
    visibleColumns: new Set(['salary']),
    sortDirection: 'asc' as const,
    onColumnSort: () => {},
    filters: {},
    onFilterChange: () => {},
    filterOptions: {},
    loadingFilterOptions: {},
  };
  for (const Table of [RadixDataGridTable, FluentDataGridTable]) {
    <Table<Employee> {...tableProps} items={employees} columns={columns} getRowId={employee => employee.id} />;
    <Table
      {...tableProps}
      items={employees}
      columns={[]}
      getRowId={employee => {
        expectType<Equal<typeof employee, Employee>>(true);
        return employee.id;
      }}
      onCellValueChanged={({ item }) => {
        expectType<Equal<typeof item, Employee>>(true);
      }}
    />;
    // @ts-expect-error Table rows must match the explicit generic.
    <Table<Employee> {...tableProps} items={['wrong']} columns={columns} getRowId={employee => employee.id} />;
  }
}
