import { useCallback, useState } from 'react';
import type { ICellValueChangedEvent } from '@alaarab/ogrid-react';
import { LiveDemo } from '../../LiveDemo';
import styles from './headless.module.css';
import { applyChange, columns, formatCell, getRowId, isNumeric, type Person, rows as initialRows } from './headlessDemoData';

function Inner() {
  const { useHeadlessGrid, useInlineEdit, useUndoRedo } = require('@alaarab/ogrid-react') as typeof import('@alaarab/ogrid-react');

  const [data, setData] = useState<Person[]>(initialRows);

  // The raw writer: this is what undo/redo replays, with old/new swapped on undo.
  const applyEdit = useCallback((event: ICellValueChangedEvent<Person>) => {
    setData((prev) => applyChange(prev, event));
  }, []);

  const undo = useUndoRedo<Person>({ onCellValueChanged: applyEdit, maxUndoDepth: 50 });
  // Defined whenever onCellValueChanged was passed; the fallback keeps TypeScript happy.
  const commit = undo.onCellValueChanged ?? applyEdit;

  const grid = useHeadlessGrid({ columns, data, getRowId, initialPageSize: 10 });

  // useInlineEdit emits { item, columnId, oldValue, newValue }; the history
  // stack wants an ICellValueChangedEvent, which also carries rowIndex.
  const edit = useInlineEdit<Person>({
    columns,
    getRowId,
    onCellEdit: (event) => commit({ ...event, rowIndex: grid.rows.indexOf(event.item) }),
  });

  const raiseSalaries = () => {
    undo.beginBatch();
    grid.rows.forEach((row, rowIndex) => {
      commit({ item: row, columnId: 'salary', oldValue: row.salary, newValue: Math.round(row.salary * 1.1), rowIndex });
    });
    undo.endBatch();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={undo.undo} disabled={!undo.canUndo}>
          Undo
        </button>
        <button type="button" className={styles.btn} onClick={undo.redo} disabled={!undo.canRedo}>
          Redo
        </button>
        <button type="button" className={styles.btn} onClick={raiseSalaries} title="beginBatch / endBatch: one undo step">
          +10% salary (batched)
        </button>
        <button type="button" className={styles.btn} onClick={undo.clear} disabled={!undo.canUndo && !undo.canRedo}>
          Clear history
        </button>
        <span className={styles.status}>
          canUndo: {String(undo.canUndo)} · canRedo: {String(undo.canRedo)} · depth {undo.maxUndoDepth}
        </span>
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the grid container dispatches the keyboard shortcuts for the table */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the grid container dispatches the keyboard shortcuts for the table */}
      <div
        className={styles.scroll}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the container is the focus target for the grid's keyboard handling
        tabIndex={0}
        onKeyDown={(e) => {
          if (edit.editingCell) return; // let the editor handle keys while editing
          const mod = e.metaKey || e.ctrlKey;
          if (!mod) return;
          if (e.key === 'z' && e.shiftKey) {
            e.preventDefault();
            undo.redo();
          } else if (e.key === 'z') {
            e.preventDefault();
            undo.undo();
          } else if (e.key === 'y') {
            e.preventDefault();
            undo.redo();
          }
        }}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              {grid.columns.map((col) => (
                <th key={col.columnId} className={styles.th}>
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={grid.getRowId(row)}>
                {grid.columns.map((col) => {
                  const editing = edit.isEditing(row, col.columnId);
                  const editable = edit.canEdit(row, col.columnId);
                  const classes = [styles.td, isNumeric(col) ? styles.numeric : '', editable ? '' : styles.readonly, editing ? styles.editing : ''].join(' ');
                  if (!editing) {
                    return (
                      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: wiring pointer events to cells is the headless hook's integration point
                      <td key={col.columnId} className={classes} onDoubleClick={() => edit.startEdit(row, col.columnId)}>
                        {formatCell(col, grid.getCellValue(row, col.columnId), row)}
                      </td>
                    );
                  }
                  const editor = edit.getEditorProps(row, col.columnId);
                  return (
                    <td key={col.columnId} className={classes}>
                      <input
                        // biome-ignore lint/a11y/noAutofocus: the editor mounts on double-click and must receive focus
                        autoFocus
                        className={styles.editor}
                        value={String(editor.value ?? '')}
                        onChange={(e) => editor.onChange(e.target.value)}
                        onBlur={editor.onBlur}
                        onKeyDown={editor.onKeyDown}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function UseUndoRedoDemo() {
  return (
    <LiveDemo height={440} title="Double-click to edit, then Ctrl/Cmd+Z to undo and Ctrl/Cmd+Shift+Z or Ctrl+Y to redo">
      {() => <Inner />}
    </LiveDemo>
  );
}
