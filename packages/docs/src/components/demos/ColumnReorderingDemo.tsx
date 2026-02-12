import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, paginationColumns } from './demoData';
import { columnReordering } from '../../stackblitz/featureDemos';

export default function ColumnReorderingDemo() {
  return (
    <LiveDemo height={420} title="Drag a column header to rearrange columns" stackblitz={columnReordering}>
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
