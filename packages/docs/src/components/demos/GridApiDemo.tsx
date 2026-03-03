import React, { useRef } from 'react';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, gridApiColumns, btnStyle, type Person } from './demoData';

function Inner() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  type IOGridApi = import('@alaarab/ogrid-react-radix').IOGridApi<Person>;

  const gridRef = useRef<IOGridApi>(null);

  return (
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
  );
}

export default function GridApiDemo() {
  return (
    <LiveDemo height={460} title="Use the buttons to control the grid programmatically">
      {() => <Inner />}
    </LiveDemo>
  );
}
