import { useRef } from 'react';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns, btnStyle, type Person } from './demoData';

function Inner() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  type IOGridApi = import('@alaarab/ogrid-react-radix').IOGridApi<Person>;

  const gridRef = useRef<IOGridApi>(null);

  return (
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
  );
}

export default function ToolbarFullDemo() {
  return (
    <LiveDemo height={520} title="Full layout  -  toolbar, sidebar, status bar, and pagination together">
      {() => <Inner />}
    </LiveDemo>
  );
}
