import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns } from './demoData';

export default function ToolbarDefaultDemo() {
  return (
    <LiveDemo height={420} title="Default layout — column chooser button in the toolbar strip">
      <OGrid
        columns={toolbarColumns}
        data={people}
        getRowId={getRowId}
        columnChooser="toolbar"
        pagination
        defaultPageSize={10}
      />
    </LiveDemo>
  );
}
