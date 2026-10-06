import { useCallback, useMemo, useState } from 'react';
import { LiveDemo } from '../../LiveDemo';
import styles from './headless.module.css';
import { applyChange, columns, formatCell, getRowId, isNumeric, type Person, rows as initialRows } from './headlessDemoData';

function Inner() {
  const { useHeadlessGrid, useRangeSelection, useCellClipboard, isInSelectionRange } = require('@alaarab/ogrid-react') as typeof import('@alaarab/ogrid-react');

  const [data, setData] = useState<Person[]>(initialRows);
  const [status, setStatus] = useState('Select cells, then Ctrl/Cmd+C, X, V (paste reads the native paste event)');

  // The hook defaults to navigator.clipboard. Ctrl/Cmd+V goes through the
  // native paste event (cb.onPaste below) and needs no permission; the Paste
  // button has no such event and reads programmatically, which the browser may
  // refuse. This override mirrors writes into memory and falls back to that
  // buffer when the read is denied, so the button still works in-demo.
  const clipboard = useMemo(() => {
    let buffer = '';
    return {
      writeText: async (text: string) => {
        buffer = text;
        try {
          await navigator.clipboard?.writeText(text);
        } catch {
          // Permission denied: the in-memory buffer still works within this demo.
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

  const grid = useHeadlessGrid({ columns, data, getRowId, initialPageSize: 10 });
  const range = useRangeSelection({ rowCount: grid.rows.length, colCount: grid.columns.length });
  const cb = useCellClipboard<Person>({
    rangeSelection: range,
    rows: grid.rows,
    getRowId,
    columns: grid.columns,
    clipboard,
    onCellEdit: useCallback((events) => {
      setData((prev) => events.reduce(applyChange, prev));
      setStatus(`Applied ${events.length} cell change${events.length === 1 ? '' : 's'}`);
    }, []),
    onClipboardError: useCallback(() => setStatus('Browser blocked clipboard access'), []),
  });

  const copy = async () => {
    await cb.copyRange();
    setStatus('Copied as TSV');
  };
  const cut = async () => {
    await cb.cutRange();
    setStatus('Cut: source clears when you paste');
  };
  const paste = async () => {
    await cb.pasteRange();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={copy} disabled={!range.range}>
          Copy
        </button>
        <button type="button" className={styles.btn} onClick={cut} disabled={!range.range}>
          Cut
        </button>
        <button type="button" className={styles.btn} onClick={paste} disabled={!range.range}>
          Paste
        </button>
        <button type="button" className={styles.btn} onClick={cb.clearClipboard} disabled={!cb.activeCopyRange && !cb.activeCutRange}>
          Clear marker
        </button>
        <span className={styles.status}>{status}</span>
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the grid container dispatches the keyboard shortcuts for the table */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the grid container dispatches the keyboard shortcuts for the table */}
      <div
        className={styles.scroll}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the container is the focus target for the grid's keyboard handling
        tabIndex={0}
        // Ctrl/Cmd+V is not handled in onKeyDown: the browser follows it with a
        // native paste event, and onPaste reads the text from that event.
        onPaste={cb.onPaste}
        onKeyDown={(e) => {
          const mod = e.metaKey || e.ctrlKey;
          if (mod && e.key === 'c') {
            e.preventDefault();
            void copy();
          } else if (mod && e.key === 'x') {
            e.preventDefault();
            void cut();
          } else if (e.key === 'Escape') {
            cb.clearClipboard();
          }
        }}
      >
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
            {grid.rows.map((row, rowIdx) => (
              <tr key={grid.getRowId(row)}>
                {grid.columns.map((col, colIdx) => {
                  const inCopy = cb.activeCopyRange ? isInSelectionRange(cb.activeCopyRange, rowIdx, colIdx) : false;
                  const inCut = cb.activeCutRange ? isInSelectionRange(cb.activeCutRange, rowIdx, colIdx) : false;
                  return (
                    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: wiring pointer events to cells is the headless hook's integration point
                    <td
                      key={col.columnId}
                      className={[styles.td, isNumeric(col) ? styles.numeric : '', col.editable ? '' : styles.readonly, range.isInRange(rowIdx, colIdx) ? styles.selected : '', inCopy ? styles.copy : '', inCut ? styles.cut : ''].join(' ')}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        if (e.shiftKey) range.extendRange(rowIdx, colIdx);
                        else range.startRange(rowIdx, colIdx);
                      }}
                      onMouseEnter={(e) => {
                        if (e.buttons === 1) range.extendRange(rowIdx, colIdx);
                      }}
                    >
                      {formatCell(col, grid.getCellValue(row, col.columnId), row)}
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

export default function UseCellClipboardDemo() {
  return (
    <LiveDemo height={440} title="Select a range, copy or cut it, select a destination, paste. Email is read-only and rejects pastes">
      {() => <Inner />}
    </LiveDemo>
  );
}
