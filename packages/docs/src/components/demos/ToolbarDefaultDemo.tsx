
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns } from './demoData';

export default function ToolbarDefaultDemo() {
  return (
    <LiveDemo height={420} title="Default layout  -  column chooser button in the toolbar strip">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={toolbarColumns}
            data={people}
            getRowId={getRowId}
            columnChooser="toolbar"
            pagination
            defaultPageSize={10}
          />
        );
      }}
    </LiveDemo>
  );
}
