import React, { useCallback, useRef, useState } from 'react';
import { OGrid, exportToCsv } from '@alaarab/ogrid-react-radix';
import type { IOGridApi, CsvColumn } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns, btnStyle, type Person } from './demoData';

const csvColumns: CsvColumn[] = toolbarColumns
  .filter(c => c.defaultVisible !== false)
  .map(c => ({ columnId: c.columnId, name: c.name }));

export default function ToolbarCustomDemo() {
  const gridRef = useRef<IOGridApi<Person>>(null);
  const [count, setCount] = useState(people.length);

  const handleExport = useCallback(() => {
    exportToCsv<Person>(
      people,
      csvColumns,
      (item, columnId) => String((item as Record<string, unknown>)[columnId] ?? ''),
      'people.csv'
    );
  }, []);

  return (
    <LiveDemo height={420} title="Custom toolbar  -  buttons on the left, column chooser on the right">
      <OGrid
        ref={gridRef}
        columns={toolbarColumns}
        data={people}
        getRowId={getRowId}
        columnChooser="toolbar"
        pagination
        defaultPageSize={10}
        onPageChange={() => setCount(people.length)}
        toolbar={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={btnStyle} onClick={handleExport}>Export CSV</button>
            <button style={btnStyle} onClick={() => gridRef.current?.selectAll()}>Select All</button>
            <span style={{ fontSize: '0.8rem', color: 'var(--ogrid-muted)' }}>
              {count} rows
            </span>
          </div>
        }
      />
    </LiveDemo>
  );
}
