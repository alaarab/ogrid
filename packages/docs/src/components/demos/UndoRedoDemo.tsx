import React, { useState, useCallback } from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import type { ICellValueChangedEvent } from '@alaarab/ogrid-react-radix';
import { useUndoRedo } from '@alaarab/ogrid-react';
import { LiveDemo } from '../LiveDemo';
import { people as initialPeople, getRowId, editingColumns, type Person } from './demoData';

export default function UndoRedoDemo() {
  const [data, setData] = useState<Person[]>(() => initialPeople.map(p => ({ ...p })));

  const handleChange = useCallback((event: ICellValueChangedEvent<Person>) => {
    setData(prev => prev.map(row =>
      getRowId(row) === getRowId(event.item)
        ? { ...row, [event.columnId]: event.newValue }
        : row
    ));
  }, []);

  const undoRedo = useUndoRedo<Person>({ onCellValueChanged: handleChange });

  return (
    <LiveDemo height={420} title="Edit a cell, then Ctrl+Z to undo, Ctrl+Y to redo">
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
    </LiveDemo>
  );
}
