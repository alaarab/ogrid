import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns } from './demoData';

export default function ToolbarSidebarDemo() {
  return (
    <LiveDemo height={480} title="Sidebar mode  -  column chooser moves to the sidebar Columns panel">
      <OGrid
        columns={toolbarColumns}
        data={people}
        getRowId={getRowId}
        columnChooser="sidebar"
        sideBar
        pagination
        defaultPageSize={10}
      />
    </LiveDemo>
  );
}
