import React from 'react';
import { OGrid } from '@alaarab/ogrid';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, selectionColumns } from './demoData';

export default function SpreadsheetSelectionDemo() {
  return (
    <LiveDemo height={420} title="Click a cell, then drag or Shift+click to select a range">
      <OGrid
        columns={selectionColumns}
        data={people}
        getRowId={getRowId}
        cellSelection
        defaultPageSize={10}
      />
    </LiveDemo>
  );
}
