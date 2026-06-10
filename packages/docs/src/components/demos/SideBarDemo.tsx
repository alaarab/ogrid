
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns } from './demoData';

export default function SideBarDemo() {
  return (
    <LiveDemo height={480} title="Click the tab icons on the right to open Columns or Filters panels">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={toolbarColumns}
            data={people}
            getRowId={getRowId}
            sideBar
            columnChooser="sidebar"
            pagination
            defaultPageSize={10}
          />
        );
      }}
    </LiveDemo>
  );
}
