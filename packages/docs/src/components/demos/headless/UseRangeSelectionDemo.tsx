import { LiveDemo } from '../../LiveDemo';
import styles from './headless.module.css';
import { columns, formatCell, getRowId, isNumeric, rows } from './headlessDemoData';

function Inner() {
  const { useHeadlessGrid, useRangeSelection } = require('@alaarab/ogrid-react') as typeof import('@alaarab/ogrid-react');

  const grid = useHeadlessGrid({ columns, data: rows, getRowId, initialPageSize: 10 });
  const range = useRangeSelection({ rowCount: grid.rows.length, colCount: grid.columns.length });

  const r = range.range;
  const summary = r
    ? `R${r.startRow + 1}C${r.startCol + 1}:R${r.endRow + 1}C${r.endCol + 1} — ${range.getRangeCells().length} cells, ${range.getRangeRows().length} rows`
    : 'No selection';

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={range.selectAll}>
          Select all
        </button>
        <button type="button" className={styles.btn} onClick={range.clearRange} disabled={!r}>
          Clear
        </button>
        <button type="button" className={styles.btn} onClick={() => range.setRange({ startRow: 1, startCol: 1, endRow: 3, endCol: 3 })}>
          setRange(R2C2:R4C4)
        </button>
        <span className={styles.status}>{summary}</span>
      </div>
      <div className={styles.scroll}>
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
                  const isAnchor = range.anchor?.row === rowIdx && range.anchor?.col === colIdx;
                  return (
                    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: wiring pointer events to cells is the headless hook's integration point
                    <td
                      key={col.columnId}
                      className={[styles.td, isNumeric(col) ? styles.numeric : '', range.isInRange(rowIdx, colIdx) ? styles.selected : '', isAnchor ? styles.active : ''].join(' ')}
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

export default function UseRangeSelectionDemo() {
  return (
    <LiveDemo height={440} title="Click a cell, then drag or Shift+click to extend. The anchor cell keeps the solid border">
      {() => <Inner />}
    </LiveDemo>
  );
}
