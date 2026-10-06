import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ICellValueChangedEvent } from '@alaarab/ogrid-react';
import { LiveDemo } from '../../LiveDemo';
import styles from './headless.module.css';
import { applyChange, columns, formatCell, getRowId, isNumeric, type Person, rows as initialRows } from './headlessDemoData';

/**
 * Every spreadsheet hook composed on one plain <table>. The data layer is
 * useHeadlessGrid; everything else is optional and layered on top.
 */
function Inner() {
  const { useHeadlessGrid, useInlineEdit, useRangeSelection, useFillHandle, useCellClipboard, useUndoRedo, useGridFocus, isInSelectionRange } = require('@alaarab/ogrid-react') as typeof import('@alaarab/ogrid-react');

  const [data, setData] = useState<Person[]>(initialRows);

  // 1. One writer. Undo/redo replays through it with old/new swapped.
  const applyEdit = useCallback((event: ICellValueChangedEvent<Person>) => {
    setData((prev) => applyChange(prev, event));
  }, []);
  const undo = useUndoRedo<Person>({ onCellValueChanged: applyEdit });
  const commit = undo.onCellValueChanged ?? applyEdit;
  const commitMany = useCallback(
    (events: ICellValueChangedEvent<Person>[]) => {
      undo.beginBatch();
      events.forEach(commit);
      undo.endBatch();
    },
    [undo.beginBatch, undo.endBatch, commit],
  );

  // 2. Data layer.
  const grid = useHeadlessGrid({ columns, data, getRowId, initialSort: { field: 'name', direction: 'asc' }, initialPageSize: 10 });

  // 3. Spreadsheet layers, all keyed to grid.rows (the current page).
  const range = useRangeSelection({ rowCount: grid.rows.length, colCount: grid.columns.length });
  const focus = useGridFocus({ rowCount: grid.rows.length, colCount: grid.columns.length, rangeSelection: range });
  const edit = useInlineEdit<Person>({
    columns,
    getRowId,
    onCellEdit: (event) => commit({ ...event, rowIndex: grid.rows.indexOf(event.item) }),
  });
  const fill = useFillHandle<Person>({ rangeSelection: range, rows: grid.rows, columns: grid.columns, onFillCells: commitMany });

  const clipboard = useMemo(() => {
    let buffer = '';
    return {
      writeText: async (text: string) => {
        buffer = text;
        try {
          await navigator.clipboard?.writeText(text);
        } catch {
          // Permission denied: fall back to the in-memory buffer.
        }
      },
      readText: async () => {
        try {
          const text = await navigator.clipboard?.readText();
          if (text) return text;
        } catch {
          // Fall through to the buffer.
        }
        return buffer;
      },
    };
  }, []);
  const cb = useCellClipboard<Person>({ rangeSelection: range, rows: grid.rows, getRowId, columns: grid.columns, clipboard, onCellEdit: commitMany });

  const { isFilling, commitFill } = fill;
  useEffect(() => {
    if (!isFilling) return;
    window.addEventListener('mouseup', commitFill);
    return () => window.removeEventListener('mouseup', commitFill);
  }, [isFilling, commitFill]);

  const navigate = focus.getKeyDownHandler();
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (edit.editingCell) return; // the editor owns the keyboard while open
    const mod = e.metaKey || e.ctrlKey;
    const active = focus.activeCell;
    if (mod && e.key === 'c') return void cb.copyRange();
    if (mod && e.key === 'x') return void cb.cutRange();
    // Ctrl/Cmd+V is left to the browser: the native paste event that follows
    // carries the text and is handled by onPaste={cb.onPaste} on the container.
    if (mod && e.key === 'z') return e.shiftKey ? undo.redo() : undo.undo();
    if (mod && e.key === 'y') return undo.redo();
    if (mod && e.key === 'a') {
      e.preventDefault();
      return range.selectAll();
    }
    if (e.key === 'Escape') return cb.clearClipboard();
    if (e.key === 'F2' && active) {
      const row = grid.rows[active.row];
      const col = grid.columns[active.col];
      if (row && col) edit.startEdit(row, col.columnId);
      return;
    }
    navigate(e);
  };

  const r = range.range;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={undo.undo} disabled={!undo.canUndo}>
          Undo
        </button>
        <button type="button" className={styles.btn} onClick={undo.redo} disabled={!undo.canRedo}>
          Redo
        </button>
        <button type="button" className={styles.btn} onClick={() => void cb.copyRange()} disabled={!r}>
          Copy
        </button>
        <button type="button" className={styles.btn} onClick={() => void cb.cutRange()} disabled={!r}>
          Cut
        </button>
        <button type="button" className={styles.btn} onClick={() => void cb.pasteRange()} disabled={!r}>
          Paste
        </button>
        <span className={styles.status}>
          {grid.rows.length} of {grid.totalCount} rows · page {grid.page}/{grid.totalPages}
        </span>
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the grid container dispatches the keyboard shortcuts for the table */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the grid container dispatches the keyboard shortcuts for the table */}
      <div
        className={styles.scroll}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the container is the focus target for the grid's keyboard handling
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPaste={cb.onPaste}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              {grid.columns.map((col) => (
                <th key={col.columnId} className={styles.th}>
                  {col.sortable ? (
                    <button type="button" className={styles.sortBtn} onClick={() => grid.toggleSort(col.columnId)}>
                      {col.name} {grid.sortIndicator(col.columnId)}
                    </button>
                  ) : (
                    col.name
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, rowIdx) => (
              <tr key={grid.getRowId(row)}>
                {grid.columns.map((col, colIdx) => {
                  const editing = edit.isEditing(row, col.columnId);
                  const inRange = range.isInRange(rowIdx, colIdx);
                  const isActive = focus.activeCell?.row === rowIdx && focus.activeCell?.col === colIdx;
                  const showHandle = !isFilling && r && rowIdx === r.endRow && colIdx === r.endCol;
                  const classes = [
                    styles.td,
                    isNumeric(col) ? styles.numeric : '',
                    col.editable ? '' : styles.readonly,
                    inRange ? styles.selected : '',
                    isActive ? styles.active : '',
                    isFilling && fill.isInFillRange(rowIdx, colIdx) && !inRange ? styles.fill : '',
                    cb.activeCopyRange && isInSelectionRange(cb.activeCopyRange, rowIdx, colIdx) ? styles.copy : '',
                    cb.activeCutRange && isInSelectionRange(cb.activeCutRange, rowIdx, colIdx) ? styles.cut : '',
                    editing ? styles.editing : '',
                  ].join(' ');

                  if (editing) {
                    const editor = edit.getEditorProps(row, col.columnId);
                    return (
                      <td key={col.columnId} className={classes}>
                        <input
                          // biome-ignore lint/a11y/noAutofocus: the editor mounts on demand and must receive focus
                          autoFocus
                          className={styles.editor}
                          value={String(editor.value ?? '')}
                          onChange={(e) => editor.onChange(e.target.value)}
                          onBlur={editor.onBlur}
                          onKeyDown={editor.onKeyDown}
                        />
                      </td>
                    );
                  }

                  return (
                    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: wiring pointer events to cells is the headless hook's integration point
                    <td
                      key={col.columnId}
                      className={classes}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        focus.setActiveCell({ row: rowIdx, col: colIdx });
                        if (e.shiftKey) range.extendRange(rowIdx, colIdx);
                        else range.startRange(rowIdx, colIdx);
                      }}
                      onMouseEnter={(e) => {
                        if (isFilling) fill.updateFill(rowIdx, colIdx);
                        else if (e.buttons === 1) range.extendRange(rowIdx, colIdx);
                      }}
                      onDoubleClick={() => edit.startEdit(row, col.columnId)}
                    >
                      {formatCell(col, grid.getCellValue(row, col.columnId), row)}
                      {showHandle ? (
                        <button
                          type="button"
                          className={styles.handle}
                          aria-label="Fill handle"
                          title="Drag to fill"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            fill.startFill();
                          }}
                        />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={() => grid.setPage(grid.page - 1)} disabled={grid.page <= 1}>
          Previous
        </button>
        <button type="button" className={styles.btn} onClick={() => grid.setPage(grid.page + 1)} disabled={grid.page >= grid.totalPages}>
          Next
        </button>
        <span className={styles.status}>Double-click or F2 edits · drag the corner to fill · Ctrl/Cmd+C/X/V · Ctrl/Cmd+Z</span>
      </div>
    </div>
  );
}

export default function HeadlessSpreadsheetDemo() {
  return (
    <LiveDemo height={520} title="All seven hooks on one plain <table>">
      {() => <Inner />}
    </LiveDemo>
  );
}
