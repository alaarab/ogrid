import React from 'react';
import { OGrid } from '@alaarab/ogrid';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, sortingColumns } from './demoData';

export default function SortingDemo() {
  return (
    <LiveDemo height={420} title="Click any column header to sort">
      <OGrid columns={sortingColumns} data={people} getRowId={getRowId} defaultPageSize={10} />
    </LiveDemo>
  );
}
