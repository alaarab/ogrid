import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns } from './demoData';

export default function SideBarDemo() {
  return (
    <LiveDemo height={480} title="Click the tab icons on the right to open Columns or Filters panels">
      <OGrid
        columns={toolbarColumns}
        data={people}
        getRowId={getRowId}
        sideBar
        columnChooser="sidebar"
        pagination
        defaultPageSize={10}
      />
    </LiveDemo>
  );
}
