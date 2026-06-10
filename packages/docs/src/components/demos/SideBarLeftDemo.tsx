
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns } from './demoData';

export default function SideBarLeftDemo() {
  return (
    <LiveDemo height={480} title="Sidebar on the left with Filters panel open by default">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        type ISideBarDef = import('@alaarab/ogrid-react-radix').ISideBarDef;
        const sideBarDef: ISideBarDef = { position: 'left', defaultPanel: 'filters' };
        return (
          <OGrid
            columns={toolbarColumns}
            data={people}
            getRowId={getRowId}
            sideBar={sideBarDef}
            columnChooser="sidebar"
            pagination
            defaultPageSize={10}
          />
        );
      }}
    </LiveDemo>
  );
}
