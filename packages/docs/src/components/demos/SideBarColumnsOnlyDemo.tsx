import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import type { ISideBarDef } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns } from './demoData';

const sideBarDef: ISideBarDef = {
  panels: ['columns'],
  defaultPanel: 'columns',
};

export default function SideBarColumnsOnlyDemo() {
  return (
    <LiveDemo height={480} title="Sidebar with only the Columns panel (no Filters tab)">
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
