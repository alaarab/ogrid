import React from 'react';
import { OGrid } from '@alaarab/ogrid';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, rowSelectionColumns } from './demoData';

export default function RowSelectionDemo() {
  return (
    <LiveDemo height={420} title="Click checkboxes to select rows, or use the header checkbox">
      <OGrid
        columns={rowSelectionColumns}
        data={people}
        getRowId={getRowId}
        rowSelection="multiple"
        defaultPageSize={10}
      />
    </LiveDemo>
  );
}
