import { useState, useCallback } from 'react';
import { LiveDemo } from '../LiveDemo';
import { people as initialPeople, getRowId, editingColumns, type Person } from './demoData';

function Inner() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  type ICellValueChangedEvent = import('@alaarab/ogrid-react-radix').ICellValueChangedEvent<Person>;

  const [data, setData] = useState<Person[]>(() => initialPeople.map(p => ({ ...p })));
  const handleChange = useCallback((event: ICellValueChangedEvent) => {
    setData(prev => prev.map(row =>
      getRowId(row) === getRowId(event.item) ? { ...row, [event.columnId]: event.newValue } : row
    ));
  }, []);

  return <OGrid columns={editingColumns} data={data} getRowId={getRowId}
    editable cellSelection onCellValueChanged={handleChange} defaultPageSize={10} />;
}

export default function KeyboardNavigationDemo() {
  return (
    <LiveDemo height={420} title="Click a cell, then use Arrow keys, Tab, Enter, or F2">
      {() => <Inner />}
    </LiveDemo>
  );
}
