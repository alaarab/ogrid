import { useState } from 'react';
import type { IColumnDef, ICellValueChangedEvent } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';

interface Row {
  id: number;
  region?: string;
  score?: number;
  unique?: unknown;
  filtered?: unknown;
  sequence?: unknown;
  split?: unknown;
  splitEnd?: unknown;
  sum?: unknown;
}

const columns: IColumnDef<Row>[] = [
  { columnId: 'region', name: 'Region', editable: true },
  { columnId: 'score', name: 'Score / count', editable: true, type: 'numeric' },
  { columnId: 'unique', name: 'Unique regions', editable: true },
  { columnId: 'filtered', name: 'Scores ≥ 3', editable: true },
  { columnId: 'sequence', name: 'Sequence', editable: true },
  { columnId: 'split', name: 'Text split', editable: true },
  { columnId: 'splitEnd', name: 'Text split', editable: true },
  { columnId: 'sum', name: 'Spill sum', editable: true },
];
const initialFormulas = [
  { col: 2, row: 0, formula: '=SORT(UNIQUE(A1:A5))' },
  { col: 3, row: 0, formula: '=FILTER(B1:B5,B1:B5>=3)' },
  { col: 4, row: 0, formula: '=SEQUENCE(B7)' },
  { col: 5, row: 0, formula: '=TEXTSPLIT("east,west",",")' },
  { col: 7, row: 0, formula: '=SUM(E1#)' },
];

function Inner() {
  const { OGrid } = require('@alaarab/ogrid-react-radix');
  const [data, setData] = useState<Row[]>([
    { id: 1, region: 'East', score: 4 },
    { id: 2, region: 'West', score: 2 },
    { id: 3, region: 'East', score: 5 },
    { id: 4, region: 'North', score: 3 },
    { id: 5, region: 'West', score: 1 },
    { id: 6 },
    { id: 7, region: 'Sequence count →', score: 3 },
    { id: 8 },
  ]);
  return <OGrid
    data={data}
    columns={columns}
    getRowId={(row: Row) => row.id}
    formulas
    cellReferences
    editable
    initialFormulas={initialFormulas}
    defaultSortBy=""
    defaultPageSize={10}
    onCellValueChanged={(event: ICellValueChangedEvent<Row>) => setData(rows => rows.map(row => row.id === event.item.id ? { ...row, [event.columnId]: event.newValue } : row))}
  />;
}

export default function DynamicArraysDemo() {
  return <LiveDemo height={440} title="Edit regions and scores, or B7 to resize the sequence. Select a spilled value to see its anchor formula.">
    {() => <Inner />}
  </LiveDemo>;
}
