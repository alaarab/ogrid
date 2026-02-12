import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, pinningColumns } from './demoData';
import { columnPinning } from '../../stackblitz/featureDemos';

export default function ColumnPinningDemo() {
  return (
    <LiveDemo height={420} title="Scroll horizontally — the Name column stays pinned" stackblitz={columnPinning}>
      <OGrid
        columns={pinningColumns}
        data={people}
        getRowId={getRowId}
        defaultPageSize={10}
      />
    </LiveDemo>
  );
}
