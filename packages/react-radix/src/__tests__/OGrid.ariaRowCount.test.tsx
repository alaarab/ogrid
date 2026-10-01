import { render } from '@testing-library/react';
import { OGrid } from '../OGrid/OGrid';
import type { IColumnDef } from '@alaarab/ogrid-react';

interface Row {
  id: number;
  name: string;
}

const columns: IColumnDef<Row>[] = [{ columnId: 'name', name: 'Name' }];
const data: Row[] = Array.from({ length: 25 }, (_, i) => ({ id: i, name: `Row ${i}` }));

describe('OGrid aria-rowcount', () => {
  it('reports the full row count on pages after the first, without a status bar', () => {
    const { container } = render(
      <OGrid<Row> columns={columns} data={data} getRowId={(r) => r.id} page={2} pageSize={10} onPageChange={() => {}} />,
    );
    // One header row + all 25 data rows, not -1 ("unknown").
    expect(container.querySelector('[role="grid"]')).toHaveAttribute('aria-rowcount', '26');
  });

  it('reports the full row count on a full first page', () => {
    const { container } = render(
      <OGrid<Row> columns={columns} data={data} getRowId={(r) => r.id} page={1} pageSize={10} onPageChange={() => {}} />,
    );
    expect(container.querySelector('[role="grid"]')).toHaveAttribute('aria-rowcount', '26');
  });
});
