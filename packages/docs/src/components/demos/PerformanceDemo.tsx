import { LiveDemo } from '../LiveDemo';
import type { Person } from './demoData';
import { people, getRowId } from './demoData';

// 50k rows: repeat the shared 1k-person fixture with distinct ids.
const bigData: Person[] = Array.from({ length: 50_000 }, (_, i) => ({
  ...people[i % people.length],
  id: i + 1,
  name: `${people[i % people.length].name} #${i + 1}`,
}));

export default function PerformanceDemo() {
  return (
    <LiveDemo height={460} title="50,000 rows — virtualized scroll, sorting runs off the main thread">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        const columns = [
          { columnId: 'name', name: 'Name', sortable: true, defaultWidth: 200 },
          { columnId: 'department', name: 'Department', sortable: true, filterable: { type: 'multiSelect' as const } },
          { columnId: 'salary', name: 'Salary', type: 'numeric' as const, sortable: true, valueFormatter: (v: unknown) => `$${Number(v).toLocaleString()}` },
          { columnId: 'startDate', name: 'Start Date', type: 'date' as const, sortable: true },
        ];
        return (
          <OGrid
            columns={columns}
            data={bigData}
            getRowId={getRowId}
            virtualScroll={{ enabled: true, paginate: false, rowHeight: 36 }}
            rowHeight={36}
            workerSort
            statusBar
            entityLabelPlural="rows"
          />
        );
      }}
    </LiveDemo>
  );
}
