import React from 'react';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, selectionColumns } from './demoData';

export default function SpreadsheetSelectionDemo() {
  return (
    <LiveDemo height={420} title="Click a cell, then drag or Shift+click to select a range">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={selectionColumns}
            data={people}
            getRowId={getRowId}
            cellSelection
            defaultPageSize={10}
          />
        );
      }}
    </LiveDemo>
  );
}
