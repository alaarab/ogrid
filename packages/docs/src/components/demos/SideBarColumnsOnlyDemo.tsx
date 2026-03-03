import React from 'react';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns } from './demoData';

export default function SideBarColumnsOnlyDemo() {
  return (
    <LiveDemo height={480} title="Sidebar with only the Columns panel (no Filters tab)">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        type ISideBarDef = import('@alaarab/ogrid-react-radix').ISideBarDef;
        const sideBarDef: ISideBarDef = { panels: ['columns'], defaultPanel: 'columns' };
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
