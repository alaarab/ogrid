import React, { useState, useCallback } from 'react';
import { OGrid } from '@alaarab/ogrid';
import type { ICellValueChangedEvent } from '@alaarab/ogrid';
import { LiveDemo } from '../LiveDemo';
import { people as initialPeople, getRowId, editingColumns, type Person } from './demoData';

export default function ClipboardDemo() {
  const [data, setData] = useState<Person[]>(() => initialPeople.map(p => ({ ...p })));

  const handleChange = useCallback((event: ICellValueChangedEvent<Person>) => {
    setData(prev => prev.map(row =>
      getRowId(row) === getRowId(event.item)
        ? { ...row, [event.columnId]: event.newValue }
        : row
    ));
  }, []);

  return (
    <LiveDemo height={420} title="Select cells, then Ctrl+C to copy, Ctrl+V to paste">
      <OGrid
        columns={editingColumns}
        data={data}
        getRowId={getRowId}
        editable
        cellSelection
        onCellValueChanged={handleChange}
        defaultPageSize={10}
      />
    </LiveDemo>
  );
}
