import { LiveDemo } from '../../LiveDemo';
import styles from './headless.module.css';
import { columns, formatCell, getRowId, isNumeric, rows } from './headlessDemoData';

function Inner() {
  const { useHeadlessGrid, useRangeSelection, useGridFocus } = require('@alaarab/ogrid-react') as typeof import('@alaarab/ogrid-react');

  const grid = useHeadlessGrid({ columns, data: rows, getRowId, initialPageSize: 12 });
  const range = useRangeSelection({ rowCount: grid.rows.length, colCount: grid.columns.length });
  const focus = useGridFocus({
    rowCount: grid.rows.length,
    colCount: grid.columns.length,
    pageSize: 5,
    rangeSelection: range, // Shift+Arrow / Shift+Home / Shift+End extend the range
  });

  const active = focus.activeCell;
  const r = range.range;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={focus.moveToStart}>
          Ctrl+Home
        </button>
        <button type="button" className={styles.btn} onClick={focus.moveToEnd}>
          Ctrl+End
        </button>
        <button type="button" className={styles.btn} onClick={() => focus.moveDown(3)}>
          moveDown(3)
        </button>
        <span className={styles.status}>
          {active ? `Active R${active.row + 1}C${active.col + 1}` : 'No active cell'}
          {r && (r.startRow !== r.endRow || r.startCol !== r.endCol) ? ` · range R${r.startRow + 1}C${r.startCol + 1}:R${r.endRow + 1}C${r.endCol + 1}` : ''}
        </span>
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the grid container dispatches the keyboard shortcuts for the table */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the grid container dispatches the keyboard shortcuts for the table */}
      <div
        className={styles.scroll}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the container is the focus target for the grid's keyboard handling
        tabIndex={0}
        onKeyDown={focus.getKeyDownHandler()}
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
            {grid.rows.map((row, rowIdx) => (
              <tr key={grid.getRowId(row)}>
                {grid.columns.map((col, colIdx) => {
                  const isActive = active?.row === rowIdx && active?.col === colIdx;
                  return (
                    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: wiring pointer events to cells is the headless hook's integration point
                    <td
                      key={col.columnId}
                      className={[styles.td, isNumeric(col) ? styles.numeric : '', range.isInRange(rowIdx, colIdx) ? styles.selected : '', isActive ? styles.active : ''].join(' ')}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        focus.setActiveCell({ row: rowIdx, col: colIdx });
                        if (e.shiftKey) range.extendRange(rowIdx, colIdx);
                        else range.startRange(rowIdx, colIdx);
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

export default function UseGridFocusDemo() {
  return (
    <LiveDemo height={480} title="Click a cell, then use Arrow, Shift+Arrow, Tab, Enter, Home/End, PageUp/PageDown">
      {() => <Inner />}
    </LiveDemo>
  );
}
