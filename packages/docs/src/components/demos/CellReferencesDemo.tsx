import React from 'react';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, cellReferencesColumns } from './demoData';

export default function CellReferencesDemo() {
  return (
    <LiveDemo height={480} title="Click cells to see the name box update with the cell reference (e.g. A1, B3)">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={cellReferencesColumns}
            data={people}
            getRowId={getRowId}
            cellReferences
            defaultPageSize={10}
            entityLabelPlural="people"
          />
        );
      }}
    </LiveDemo>
  );
}
