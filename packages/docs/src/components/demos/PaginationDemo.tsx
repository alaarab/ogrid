
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, paginationColumns } from './demoData';

export default function PaginationDemo() {
  return (
    <LiveDemo height={420} title="Use the pagination controls to navigate pages">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={paginationColumns}
            data={people}
            getRowId={getRowId}
            defaultPageSize={5}
            pageSizeOptions={[5, 10, 25, 50]}
            entityLabelPlural="people"
          />
        );
      }}
    </LiveDemo>
  );
}
