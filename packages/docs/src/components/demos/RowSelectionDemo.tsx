
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, rowSelectionColumns } from './demoData';

export default function RowSelectionDemo() {
  return (
    <LiveDemo height={420} title="Click checkboxes to select rows, or use the header checkbox">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={rowSelectionColumns}
            data={people}
            getRowId={getRowId}
            rowSelection="multiple"
            defaultPageSize={10}
          />
        );
      }}
    </LiveDemo>
  );
}
