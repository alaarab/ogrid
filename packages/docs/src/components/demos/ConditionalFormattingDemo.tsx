import { useMemo, useState } from 'react';
import { LiveDemo } from '../LiveDemo';
import type { IColumnDef, IConditionalFormatRule } from '@alaarab/ogrid-react-radix';

interface SalesRow {
  id: number;
  rep: string;
  region: string;
  revenue: number;
  growth: number;
  margin: number;
}

const reps = ['Avery', 'Blake', 'Casey', 'Devon', 'Emery', 'Finley', 'Gray', 'Harper', 'Indigo', 'Jordan', 'Kai', 'Logan', 'Morgan', 'Noel', 'Oakley', 'Parker', 'Quinn', 'Reese', 'Sage', 'Taylor'];
const regions = ['North', 'South', 'East', 'West'];

const salesRows: SalesRow[] = reps.map((rep, i) => ({
  id: i + 1,
  rep,
  region: regions[i % 4] as string,
  revenue: 40_000 + ((i * 37_919) % 160_000),
  growth: Math.round((((i * 13) % 41) - 12) * 10) / 10,
  margin: 8 + ((i * 7) % 30),
}));

const money = (v: unknown) => (typeof v === 'number' ? `$${v.toLocaleString()}` : '');

const salesColumns: IColumnDef<SalesRow>[] = [
  { columnId: 'rep', name: 'Rep', defaultWidth: 110 },
  { columnId: 'region', name: 'Region', defaultWidth: 90 },
  { columnId: 'revenue', name: 'Revenue', type: 'numeric', defaultWidth: 140, valueFormatter: money, editable: true },
  { columnId: 'growth', name: 'Growth %', type: 'numeric', defaultWidth: 110, editable: true },
  { columnId: 'margin', name: 'Margin %', type: 'numeric', defaultWidth: 110, editable: true },
];

function SalesGrid() {
  // Required at render time: the grid is browser-only (see LiveDemo).
  const { OGrid, COLOR_SCALES, CONDITIONAL_FORMAT_STYLES } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  const [data, setData] = useState(salesRows);
  const rules = useMemo<IConditionalFormatRule<SalesRow>[]>(() => [
    { type: 'dataBar', columnIds: ['revenue'] },
    { type: 'topBottom', columnIds: ['revenue'], direction: 'top', rank: 10, percent: true, style: { ...CONDITIONAL_FORMAT_STYLES.greenFillDarkGreenText, bold: true } },
    { type: 'colorScale', columnIds: ['margin'], stops: COLOR_SCALES.greenYellowRed },
    { type: 'cellValue', columnIds: ['growth'], operator: 'greaterThan', value: 15, style: CONDITIONAL_FORMAT_STYLES.yellowFillDarkYellowText },
    { type: 'cellValue', columnIds: ['growth'], operator: 'lessThan', value: 0, style: CONDITIONAL_FORMAT_STYLES.redText },
  ], [COLOR_SCALES, CONDITIONAL_FORMAT_STYLES]);
  return (
    <OGrid
      columns={salesColumns}
      data={data}
      getRowId={(r: SalesRow) => r.id}
      conditionalFormats={rules}
      editable
      onCellValueChanged={(e) =>
        setData((prev) => prev.map((r) => (r.id === (e.item as SalesRow).id ? { ...r, [e.columnId]: Number(e.newValue) } : r)))
      }
      defaultSortBy=""
      defaultPageSize={25}
    />
  );
}

export default function ConditionalFormattingDemo() {
  return (
    <LiveDemo height={460} title="Data bars on revenue, top 10% in green, margin color scale, growth over 15% highlighted  -  edit a value and watch the formats update">
      {() => <SalesGrid />}
    </LiveDemo>
  );
}
