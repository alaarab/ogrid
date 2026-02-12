import React, { useState, useCallback } from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import type { ICellValueChangedEvent } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people as initialPeople, getRowId, editingColumns, type Person } from './demoData';
import { contextMenu } from '../../stackblitz/featureDemos';

export default function ContextMenuDemo() {
  const [data, setData] = useState<Person[]>(() => initialPeople.map(p => ({ ...p })));
  const handleChange = useCallback((event: ICellValueChangedEvent<Person>) => {
    setData(prev => prev.map(row =>
      getRowId(row) === getRowId(event.item) ? { ...row, [event.columnId]: event.newValue } : row
    ));
  }, []);

  return (
    <LiveDemo height={420} title="Right-click any cell to open the context menu" stackblitz={contextMenu}>
      <OGrid columns={editingColumns} data={data} getRowId={getRowId}
        editable onCellValueChanged={handleChange} defaultPageSize={10} />
    </LiveDemo>
  );
}
