import React from 'react';
import { LiveDemo } from '../LiveDemo';

interface RevenueRow {
  id: number;
  region: string;
  revenue: number;
  deals: number;
}

function makeRows(seed: number): RevenueRow[] {
  return ['North', 'South', 'East', 'West', 'Central'].map((region, i) => ({
    id: i + 1,
    region,
    revenue: 100_000 + ((seed * 7 + i * 13) % 9) * 25_000,
    deals: 8 + ((seed * 3 + i * 5) % 20),
  }));
}

const dataBySheet: Record<string, RevenueRow[]> = {
  q1: makeRows(1),
  q2: makeRows(2),
  fy: makeRows(3),
};

const sheets = [
  { id: 'q1', name: 'Q1' },
  { id: 'q2', name: 'Q2' },
  { id: 'fy', name: 'Full Year', color: '#217346' },
];

export default function MultiSheetDemo() {
  return (
    <LiveDemo height={360} title="Switch sheets with the tab bar along the bottom">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        const columns = [
          { columnId: 'region', name: 'Region' },
          { columnId: 'revenue', name: 'Revenue', type: 'numeric' as const, valueFormatter: (v: unknown) => `$${Number(v).toLocaleString()}` },
          { columnId: 'deals', name: 'Deals', type: 'numeric' as const },
        ];
        function Workbook() {
          const [activeSheet, setActiveSheet] = React.useState('q1');
          return (
            <OGrid
              columns={columns}
              data={dataBySheet[activeSheet]}
              getRowId={(r: RevenueRow) => r.id}
              sheetDefs={sheets}
              activeSheet={activeSheet}
              onSheetChange={setActiveSheet}
            />
          );
        }
        return <Workbook />;
      }}
    </LiveDemo>
  );
}
