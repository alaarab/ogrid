import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, sortingColumns } from './demoData';
import { sorting } from '../../stackblitz/featureDemos';

export default function SortingDemo() {
  return (
    <LiveDemo height={420} title="Click any column header to sort" stackblitz={sorting}>
      <OGrid columns={sortingColumns} data={people} getRowId={getRowId} defaultPageSize={10} />
    </LiveDemo>
  );
}
