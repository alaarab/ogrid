import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import type { ISideBarDef } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns } from './demoData';

const sideBarDef: ISideBarDef = {
  position: 'left',
  defaultPanel: 'filters',
};

export default function SideBarLeftDemo() {
  return (
    <LiveDemo height={480} title="Sidebar on the left with Filters panel open by default">
      <OGrid
        columns={toolbarColumns}
        data={people}
        getRowId={getRowId}
        sideBar={sideBarDef}
        columnChooser="sidebar"
        pagination
        defaultPageSize={10}
      />
    </LiveDemo>
  );
}
