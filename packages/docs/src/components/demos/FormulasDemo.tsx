import React, { useState, useCallback } from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import type { ICellValueChangedEvent, IColumnDef } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';

interface Row {
  id: string;
  a: number;
  b: number;
  c: number;
}

const initialData: Row[] = [
  { id: 'r1', a: 10, b: 20, c: 0 },
  { id: 'r2', a: 30, b: 40, c: 0 },
  { id: 'r3', a: 50, b: 60, c: 0 },
  { id: 'r4', a: 0, b: 0, c: 0 },
];

const formulaColumns: IColumnDef<Row>[] = [
  { columnId: 'a', name: 'A', type: 'numeric', editable: true },
  { columnId: 'b', name: 'B', type: 'numeric', editable: true },
  { columnId: 'c', name: 'C', type: 'numeric', editable: true },
];

export default function FormulasDemo() {
  const [data, setData] = useState<Row[]>(() => initialData.map((r) => ({ ...r })));

  const handleChange = useCallback((event: ICellValueChangedEvent<Row>) => {
    setData((prev) =>
      prev.map((row) =>
        row.id === event.item.id ? { ...row, [event.columnId]: event.newValue } : row
      )
    );
  }, []);

  return (
    <LiveDemo height={320} title="Type =A1+B1 in C1 or =SUM(A1:A3) in A4. Formulas recalculate live.">
      <OGrid
        columns={formulaColumns}
        data={data}
        getRowId={(r) => r.id}
        editable
        formulas
        onCellValueChanged={handleChange}
        cellReferences
        initialFormulas={[
          { col: 2, row: 0, formula: '=A1+B1' },
          { col: 2, row: 1, formula: '=A2+B2' },
          { col: 2, row: 2, formula: '=A3+B3' },
          { col: 0, row: 3, formula: '=SUM(A1:A3)' },
          { col: 1, row: 3, formula: '=SUM(B1:B3)' },
          { col: 2, row: 3, formula: '=SUM(C1:C3)' },
        ]}
        pagination={false}
        statusBar
      />
    </LiveDemo>
  );
}
