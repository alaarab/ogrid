
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns } from './demoData';

export default function ToolbarSidebarDemo() {
  return (
    <LiveDemo height={480} title="Sidebar mode  -  column chooser moves to the sidebar Columns panel">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={toolbarColumns}
            data={people}
            getRowId={getRowId}
            columnChooser="sidebar"
            sideBar
            pagination
            defaultPageSize={10}
          />
        );
      }}
    </LiveDemo>
  );
}
