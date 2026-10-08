import { LiveDemo } from '../LiveDemo';
import { people, getRowId, pinningColumns } from './demoData';

export default function FrozenRowsDemo() {
  return (
    <LiveDemo height={420} title="Scroll down  -  the first two rows stay frozen under the header; scroll right  -  Name stays pinned">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={pinningColumns}
            data={people}
            getRowId={getRowId}
            frozenRows={2}
            defaultPageSize={50}
          />
        );
      }}
    </LiveDemo>
  );
}
