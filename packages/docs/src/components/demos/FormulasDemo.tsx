import React, { useState, useCallback } from 'react';
import { LiveDemo } from '../LiveDemo';

interface Row {
  id: string;
  revenue: number;
  cost: number;
  profit: number;
}

const initialData: Row[] = [
  { id: 'r1', revenue: 1200, cost: 800, profit: 0 },
  { id: 'r2', revenue: 3400, cost: 1500, profit: 0 },
  { id: 'r3', revenue: 2100, cost: 900, profit: 0 },
  { id: 'r4', revenue: 0, cost: 0, profit: 0 },
];

function Inner() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  type ICellValueChangedEvent = import('@alaarab/ogrid-react-radix').ICellValueChangedEvent<Row>;
  type IColumnDef = import('@alaarab/ogrid-react-radix').IColumnDef<Row>;
  type ISheetDef = import('@alaarab/ogrid-react-radix').ISheetDef;

  const formulaColumns: IColumnDef[] = [
    { columnId: 'revenue', name: 'Revenue', type: 'numeric', editable: true },
    { columnId: 'cost', name: 'Cost', type: 'numeric', editable: true },
    { columnId: 'profit', name: 'Profit', type: 'numeric', editable: true },
  ];

  const sheetDefs: ISheetDef[] = [
    { id: 'sheet1', name: 'Sheet1' },
    { id: 'sheet2', name: 'Sheet2' },
    { id: 'sheet3', name: 'Sheet3' },
  ];

  const [data, setData] = useState<Row[]>(() => initialData.map((r) => ({ ...r })));
  const [activeSheet, setActiveSheet] = useState('sheet1');

  const handleChange = useCallback((event: ICellValueChangedEvent) => {
    setData((prev) =>
      prev.map((row) =>
        row.id === event.item.id ? { ...row, [event.columnId]: event.newValue } : row
      )
    );
  }, []);

  return (
    <OGrid
      columns={formulaColumns}
      data={data}
      getRowId={(r) => r.id}
      editable
      formulas
      onCellValueChanged={handleChange}
      initialFormulas={[
        { col: 2, row: 0, formula: '=A1+B1' },
        { col: 2, row: 1, formula: '=A2+B2' },
        { col: 2, row: 2, formula: '=A3+B3' },
        { col: 0, row: 3, formula: '=SUM(A1:A3)' },
        { col: 1, row: 3, formula: '=SUM(B1:B3)' },
        { col: 2, row: 3, formula: '=SUM(C1:C3)' },
      ]}
      sheetDefs={sheetDefs}
      activeSheet={activeSheet}
      onSheetChange={setActiveSheet}
      statusBar
    />
  );
}

export default function FormulasDemo() {
  return (
    <LiveDemo height={380} title="Click a cell, then edit in the formula bar. Type =A1+B1 in C1 or =SUM(A1:A3) in A4.">
      {() => <Inner />}
    </LiveDemo>
  );
}
