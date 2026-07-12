import { LiveDemo } from '../LiveDemo';
import { people, getRowId, editingColumns } from './demoData';

export default function MobileTouchDemo() {
  return (
    <LiveDemo
      height={420}
      title="Drag to select cells, drag the fill handle, resize columns — the same pointer gestures work with touch"
    >
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={editingColumns}
            data={people}
            getRowId={getRowId}
            cellSelection
            editable
            defaultPageSize={10}
          />
        );
      }}
    </LiveDemo>
  );
}
