import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OGrid } from '../OGrid/OGrid';

interface Row {
  id: string;
  [key: string]: string;
}

const sheetA = {
  columns: [
    { columnId: 'a1', name: 'A One', renderCell: (r: Row) => <span data-testid="cell-a1">{r.a1}</span> },
    { columnId: 'a2', name: 'A Two', renderCell: (r: Row) => <span data-testid="cell-a2">{r.a2}</span> },
    { columnId: 'a3', name: 'A Three', renderCell: (r: Row) => <span data-testid="cell-a3">{r.a3}</span> },
  ],
  data: [
    { id: '1', a1: 'x1', a2: 'x2', a3: 'x3' },
    { id: '2', a1: 'y1', a2: 'y2', a3: 'y3' },
  ] as Row[],
};

const sheetB = {
  columns: [
    { columnId: 'b1', name: 'B One', renderCell: (r: Row) => <span data-testid="cell-b1">{r.b1}</span> },
    { columnId: 'b2', name: 'B Two', renderCell: (r: Row) => <span data-testid="cell-b2">{r.b2}</span> },
  ],
  data: [
    { id: '1', b1: 'p1', b2: 'p2' },
    { id: '2', b1: 'q1', b2: 'q2' },
  ] as Row[],
};

const sheetDefs = [
  { id: 'a', name: 'Sheet A' },
  { id: 'b', name: 'Sheet B' },
];

function Workbook(): React.ReactElement {
  const [active, setActive] = React.useState('a');
  const sheet = active === 'a' ? sheetA : sheetB;
  return (
    <OGrid
      columns={sheet.columns}
      data={sheet.data}
      getRowId={(r: Row) => r.id}
      sheetDefs={sheetDefs}
      activeSheet={active}
      onSheetChange={setActive}
      defaultPageSize={10}
    />
  );
}

function chooserLabel(): string {
  const btn = screen.getByRole('button', { name: /column visibility/i });
  const spans = Array.from(btn.querySelectorAll('span'));
  return spans.map((s) => s.textContent ?? '').find((t) => t.includes('Column Visibility')) ?? '';
}

describe('OGrid sheet switching + column visibility', () => {
  it('keeps the visible-column set coherent when the column set changes', () => {
    render(<Workbook />);

    expect(chooserLabel()).toBe('Column Visibility (3 of 3)');
    expect(screen.getAllByTestId('cell-a1')).toHaveLength(2);

    fireEvent.click(screen.getByRole('tab', { name: 'Sheet B' }));

    // Count must reflect sheet B's columns, not sheet A's stale ids.
    expect(chooserLabel()).toBe('Column Visibility (2 of 2)');
    // ...and sheet B's rows must render.
    expect(screen.getAllByTestId('cell-b1').map((el) => el.textContent)).toEqual(['p1', 'q1']);
    expect(screen.getAllByTestId('cell-b2').map((el) => el.textContent)).toEqual(['p2', 'q2']);
    expect(screen.queryAllByTestId('cell-a1')).toHaveLength(0);
  });

  it('preserves a deliberate hide for columns that survive the switch', () => {
    function Overlapping(): React.ReactElement {
      const [active, setActive] = React.useState('a');
      const shared = {
        columnId: 'shared',
        name: 'Shared',
        renderCell: (r: Row) => <span data-testid="cell-shared">{r.shared}</span>,
      };
      const columns = active === 'a' ? [shared, ...sheetA.columns] : [shared, ...sheetB.columns];
      const data = (active === 'a' ? sheetA.data : sheetB.data).map((r) => ({ ...r, shared: 's' }));
      return (
        <OGrid
          columns={columns}
          data={data}
          getRowId={(r: Row) => r.id}
          sheetDefs={sheetDefs}
          activeSheet={active}
          onSheetChange={setActive}
          defaultPageSize={10}
        />
      );
    }
    render(<Overlapping />);

    fireEvent.click(screen.getByRole('button', { name: /column visibility/i }));
    fireEvent.click(screen.getByLabelText('Shared'));
    fireEvent.click(screen.getByRole('button', { name: /column visibility/i }));
    expect(screen.queryAllByTestId('cell-shared')).toHaveLength(0);

    fireEvent.click(screen.getByRole('tab', { name: 'Sheet B' }));

    // 'shared' still exists on sheet B and was deliberately hidden  -  stays hidden.
    expect(screen.queryAllByTestId('cell-shared')).toHaveLength(0);
    // New columns show by default and rows render.
    expect(screen.getAllByTestId('cell-b1')).toHaveLength(2);
    expect(chooserLabel()).toBe('Column Visibility (2 of 3)');
  });

  it('gives a sheet its column choices back when the user returns to it', () => {
    render(<Workbook />);

    fireEvent.click(screen.getByRole('button', { name: /column visibility/i }));
    fireEvent.click(screen.getByLabelText('A Two'));
    fireEvent.click(screen.getByRole('button', { name: /column visibility/i }));
    expect(chooserLabel()).toBe('Column Visibility (2 of 3)');
    expect(screen.queryAllByTestId('cell-a2')).toHaveLength(0);

    fireEvent.click(screen.getByRole('tab', { name: 'Sheet B' }));
    expect(chooserLabel()).toBe('Column Visibility (2 of 2)');

    fireEvent.click(screen.getByRole('tab', { name: 'Sheet A' }));

    // Sheet A comes back the way the user left it, not reseeded from defaults.
    expect(chooserLabel()).toBe('Column Visibility (2 of 3)');
    expect(screen.queryAllByTestId('cell-a2')).toHaveLength(0);
    expect(screen.getAllByTestId('cell-a1')).toHaveLength(2);
  });
});
