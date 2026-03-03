import React from 'react';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, sortingColumns } from './demoData';

export default function SortingDemo() {
  return (
    <LiveDemo height={420} title="Click any column header to sort">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return <OGrid columns={sortingColumns} data={people} getRowId={getRowId} defaultPageSize={10} />;
      }}
    </LiveDemo>
  );
}
