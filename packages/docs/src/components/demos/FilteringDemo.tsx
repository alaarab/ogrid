import React from 'react';
import { OGrid } from '@alaarab/ogrid';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, filteringColumns } from './demoData';

export default function FilteringDemo() {
  return (
    <LiveDemo height={420} title="Click the filter icon in a column header to filter">
      <OGrid columns={filteringColumns} data={people} getRowId={getRowId} defaultPageSize={10} />
    </LiveDemo>
  );
}
