import { LiveDemo } from '../LiveDemo';
import { people, getRowId, sortingColumns } from './demoData';

export default function MultiSortDemo() {
  return (
    <LiveDemo height={420} title="Sorted by Department, then Salary (descending). Shift+click a header to add a level">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={sortingColumns}
            data={people}
            getRowId={getRowId}
            defaultPageSize={10}
            defaultSortModel={[
              { field: 'department', direction: 'asc' },
              { field: 'salary', direction: 'desc' },
            ]}
          />
        );
      }}
    </LiveDemo>
  );
}
