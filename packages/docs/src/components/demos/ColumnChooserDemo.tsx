
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, columnChooserColumns } from './demoData';

export default function ColumnChooserDemo() {
  return (
    <LiveDemo height={420} title="Use the column chooser to show/hide columns">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={columnChooserColumns}
            data={people}
            getRowId={getRowId}
            defaultPageSize={10}
          />
        );
      }}
    </LiveDemo>
  );
}
