import React, { useState, useCallback } from 'react';
import { LiveDemo } from '../LiveDemo';
import { people as initialPeople, getRowId, editingColumns, type Person } from './demoData';

function Inner() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  type ICellValueChangedEvent = import('@alaarab/ogrid-react-radix').ICellValueChangedEvent<Person>;

  const [data, setData] = useState<Person[]>(() => initialPeople.map(p => ({ ...p })));

  const handleChange = useCallback((event: ICellValueChangedEvent) => {
    setData(prev => prev.map(row =>
      getRowId(row) === getRowId(event.item)
        ? { ...row, [event.columnId]: event.newValue }
        : row
    ));
  }, []);

  return (
    <OGrid
      columns={editingColumns}
      data={data}
      getRowId={getRowId}
      editable
      onCellValueChanged={handleChange}
      defaultPageSize={10}
    />
  );
}

export default function CellEditingDemo() {
  return (
    <LiveDemo height={420} title="Double-click any cell to edit, or press F2">
      {() => <Inner />}
    </LiveDemo>
  );
}
