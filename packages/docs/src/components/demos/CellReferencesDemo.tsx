import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, cellReferencesColumns } from './demoData';

export default function CellReferencesDemo() {
  return (
    <LiveDemo height={480} title="Click cells to see the name box update with the cell reference (e.g. A1, B3)">
      <OGrid
        columns={cellReferencesColumns}
        data={people}
        getRowId={getRowId}
        cellReferences
        defaultPageSize={10}
        entityLabelPlural="people"
      />
    </LiveDemo>
  );
}
