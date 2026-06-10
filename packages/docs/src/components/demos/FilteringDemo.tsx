
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, filteringColumns } from './demoData';

export default function FilteringDemo() {
  return (
    <LiveDemo height={420} title="Click the filter icon in a column header to filter">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return <OGrid columns={filteringColumns} data={people} getRowId={getRowId} defaultPageSize={10} />;
      }}
    </LiveDemo>
  );
}
