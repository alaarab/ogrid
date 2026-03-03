import React from 'react';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, paginationColumns } from './demoData';

export default function ColumnReorderingDemo() {
  return (
    <LiveDemo height={420} title="Drag a column header to rearrange columns">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={paginationColumns}
            data={people}
            getRowId={getRowId}
            columnReorder
            defaultPageSize={10}
          />
        );
      }}
    </LiveDemo>
  );
}
