import { useState, useCallback } from 'react';
import { LiveDemo } from '../LiveDemo';
import { people as initialPeople, getRowId, editingColumns, type Person } from './demoData';

function Inner() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  const { useUndoRedo } = require('@alaarab/ogrid-react') as typeof import('@alaarab/ogrid-react');
  type ICellValueChangedEvent = import('@alaarab/ogrid-react-radix').ICellValueChangedEvent<Person>;

  const [data, setData] = useState<Person[]>(() => initialPeople.map(p => ({ ...p })));

  const handleChange = useCallback((event: ICellValueChangedEvent) => {
    setData(prev => prev.map(row =>
      getRowId(row) === getRowId(event.item)
        ? { ...row, [event.columnId]: event.newValue }
        : row
    ));
  }, []);

  const undoRedo = useUndoRedo<Person>({ onCellValueChanged: handleChange });

  return (
    <OGrid
      columns={editingColumns}
      data={data}
      getRowId={getRowId}
      editable
      onCellValueChanged={undoRedo.onCellValueChanged}
      onUndo={undoRedo.undo}
      onRedo={undoRedo.redo}
      canUndo={undoRedo.canUndo}
      canRedo={undoRedo.canRedo}
      defaultPageSize={10}
    />
  );
}

export default function UndoRedoDemo() {
  return (
    <LiveDemo height={420} title="Edit a cell, then Ctrl+Z to undo, Ctrl+Y to redo">
      {() => <Inner />}
    </LiveDemo>
  );
}
