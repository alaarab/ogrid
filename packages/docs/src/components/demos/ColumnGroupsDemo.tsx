import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, columnGroupColumns } from './demoData';

export default function ColumnGroupsDemo() {
  return (
    <LiveDemo height={420} title="Column headers are grouped into 'Personal Info' and 'Employment'">
      <OGrid
        columns={columnGroupColumns}
        data={people}
        getRowId={getRowId}
        defaultPageSize={10}
      />
    </LiveDemo>
  );
}
