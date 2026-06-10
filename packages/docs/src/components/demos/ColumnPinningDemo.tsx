
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, pinningColumns } from './demoData';

export default function ColumnPinningDemo() {
  return (
    <LiveDemo height={420} title="Scroll horizontally  -  the Name column stays pinned">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={pinningColumns}
            data={people}
            getRowId={getRowId}
            defaultPageSize={10}
          />
        );
      }}
    </LiveDemo>
  );
}
