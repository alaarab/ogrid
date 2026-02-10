import React from 'react';
import { OGrid } from '@alaarab/ogrid';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, columnChooserColumns } from './demoData';

export default function ColumnChooserDemo() {
  return (
    <LiveDemo height={420} title="Use the column chooser to show/hide columns">
      <OGrid
        columns={columnChooserColumns}
        data={people}
        getRowId={getRowId}
        defaultPageSize={10}
      />
    </LiveDemo>
  );
}
