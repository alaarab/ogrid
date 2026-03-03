import React from 'react';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, columnGroupColumns } from './demoData';

export default function ColumnGroupsDemo() {
  return (
    <LiveDemo height={420} title="Column headers are grouped into 'Personal Info' and 'Employment'">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={columnGroupColumns}
            data={people}
            getRowId={getRowId}
            defaultPageSize={10}
          />
        );
      }}
    </LiveDemo>
  );
}
