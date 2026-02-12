import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, filteringColumns } from './demoData';
import { filtering } from '../../stackblitz/featureDemos';

export default function FilteringDemo() {
  return (
    <LiveDemo height={420} title="Click the filter icon in a column header to filter" stackblitz={filtering}>
      <OGrid columns={filteringColumns} data={people} getRowId={getRowId} defaultPageSize={10} />
    </LiveDemo>
  );
}
