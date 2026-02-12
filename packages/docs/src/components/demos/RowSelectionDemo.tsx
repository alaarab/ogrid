import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, rowSelectionColumns } from './demoData';
import { rowSelection } from '../../stackblitz/featureDemos';

export default function RowSelectionDemo() {
  return (
    <LiveDemo height={420} title="Click checkboxes to select rows, or use the header checkbox" stackblitz={rowSelection}>
      <OGrid
        columns={rowSelectionColumns}
        data={people}
        getRowId={getRowId}
        rowSelection="multiple"
        defaultPageSize={10}
      />
    </LiveDemo>
  );
}
