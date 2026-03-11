import type {
  IDataSource,
  IColumnDef,
  IColumnGroupDef,
} from '@alaarab/ogrid-core';

export type ExampleRow = { id: string; [key: string]: unknown };

export type ExampleColumns = Array<IColumnDef<ExampleRow> | IColumnGroupDef<ExampleRow>>;

export function coerceExampleRows(rows: unknown): ExampleRow[] {
  return rows as ExampleRow[];
}

export function coerceExampleColumns(columns: unknown): ExampleColumns {
  return columns as ExampleColumns;
}

export function coerceExampleDataSource(dataSource: unknown): IDataSource<ExampleRow> {
  return dataSource as IDataSource<ExampleRow>;
}
