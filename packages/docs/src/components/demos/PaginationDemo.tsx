import React from 'react';
import { OGrid } from '@alaarab/ogrid';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, paginationColumns } from './demoData';

export default function PaginationDemo() {
  return (
    <LiveDemo height={420} title="Use the pagination controls to navigate pages">
      <OGrid
        columns={paginationColumns}
        data={people}
        getRowId={getRowId}
        defaultPageSize={5}
        entityLabelPlural="people"
      />
    </LiveDemo>
  );
}
