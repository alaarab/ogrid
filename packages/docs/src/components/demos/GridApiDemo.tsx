import React, { useRef } from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import type { IOGridApi } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, gridApiColumns, btnStyle, type Person } from './demoData';

export default function GridApiDemo() {
  const gridRef = useRef<IOGridApi<Person>>(null);

  return (
    <LiveDemo height={460} title="Use the buttons to control the grid programmatically">
      <OGrid
        ref={gridRef}
        columns={gridApiColumns}
        data={people}
        getRowId={getRowId}
        rowSelection="multiple"
        defaultPageSize={10}
        toolbar={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btnStyle} onClick={() => gridRef.current?.selectAll()}>Select All</button>
            <button style={btnStyle} onClick={() => gridRef.current?.deselectAll()}>Deselect All</button>
            <button style={btnStyle} onClick={() => gridRef.current?.applyColumnState({
              sort: { field: 'salary', direction: 'desc' }
            })}>Sort by Salary (desc)</button>
          </div>
        }
      />
    </LiveDemo>
  );
}
