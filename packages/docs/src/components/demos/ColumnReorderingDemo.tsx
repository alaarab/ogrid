import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, paginationColumns } from './demoData';

export default function ColumnReorderingDemo() {
  return (
    <LiveDemo height={420} title="Drag a column header to rearrange columns">
      <OGrid
        columns={paginationColumns}
        data={people}
        getRowId={getRowId}
        columnReorder
        defaultPageSize={10}
      />
    </LiveDemo>
  );
}
