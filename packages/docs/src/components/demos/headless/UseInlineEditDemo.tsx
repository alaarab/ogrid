import { useCallback, useState } from 'react';
import { LiveDemo } from '../../LiveDemo';
import styles from './headless.module.css';
import { applyChange, columns, formatCell, getRowId, isNumeric, type Person, rows as initialRows } from './headlessDemoData';

function Inner() {
  const { useHeadlessGrid, useInlineEdit } = require('@alaarab/ogrid-react') as typeof import('@alaarab/ogrid-react');

  const [data, setData] = useState<Person[]>(initialRows);
  const [lastCommit, setLastCommit] = useState('No edits yet');

  const grid = useHeadlessGrid({ columns, data, getRowId, initialPageSize: 10 });

  const edit = useInlineEdit<Person>({
    columns,
    getRowId,
    onCellEdit: useCallback((event) => {
      setData((prev) => applyChange(prev, event));
      setLastCommit(`${event.item.name}: ${event.columnId} ${String(event.oldValue)} → ${String(event.newValue)}`);
    }, []),
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span>
          Editing: {edit.editingCell ? `row ${edit.editingCell.rowId}, ${edit.editingCell.columnId}` : 'none'}
        </span>
        <span className={styles.status}>{lastCommit}</span>
      </div>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {grid.columns.map((col) => (
                <th key={col.columnId} className={styles.th}>
                  {col.name}
                  {col.editable ? '' : ' (read-only)'}
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
                  const classes = [styles.td, isNumeric(col) ? styles.numeric : '', editable ? '' : styles.readonly, editing ? styles.editing : ''];
                  if (!editing) {
                    return (
                      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: wiring pointer events to cells is the headless hook's integration point
                      <td
                        key={col.columnId}
                        className={classes.join(' ')}
                        title={editable ? 'Double-click to edit' : 'Not editable'}
                        onDoubleClick={() => edit.startEdit(row, col.columnId)}
                      >
                        {formatCell(col, grid.getCellValue(row, col.columnId), row)}
                      </td>
                    );
                  }
                  // getEditorProps hands back value/onChange/onBlur/onKeyDown.
                  // onChange takes the new *value*, so unwrap the DOM event here.
                  const editor = edit.getEditorProps(row, col.columnId);
                  return (
                    <td key={col.columnId} className={classes.join(' ')}>
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

export default function UseInlineEditDemo() {
  return (
    <LiveDemo height={440} title="Double-click a cell to edit. Enter commits, Escape cancels. Salary rejects negatives; Email is read-only">
      {() => <Inner />}
    </LiveDemo>
  );
}
