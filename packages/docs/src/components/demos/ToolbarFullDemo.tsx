import React, { useRef } from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import type { IOGridApi } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns, btnStyle, type Person } from './demoData';

export default function ToolbarFullDemo() {
  const gridRef = useRef<IOGridApi<Person>>(null);

  return (
    <LiveDemo height={520} title="Full layout — toolbar, sidebar, status bar, and pagination together">
      <OGrid
        ref={gridRef}
        columns={toolbarColumns}
        data={people}
        getRowId={getRowId}
        columnChooser="toolbar"
        sideBar
        statusBar
        cellSelection
        pagination
        defaultPageSize={10}
        toolbar={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={btnStyle} onClick={() => gridRef.current?.deselectAll()}>Clear Selection</button>
            <span style={{ fontSize: '0.8rem', color: 'var(--ogrid-muted)' }}>
              Full-featured layout
            </span>
          </div>
        }
      />
    </LiveDemo>
  );
}
