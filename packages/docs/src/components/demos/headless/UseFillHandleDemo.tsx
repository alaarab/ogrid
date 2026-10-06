import { useCallback, useEffect, useState } from 'react';
import { LiveDemo } from '../../LiveDemo';
import styles from './headless.module.css';
import { applyChange, columns, formatCell, getRowId, isNumeric, type Person, rows as initialRows } from './headlessDemoData';

function Inner() {
  const { useHeadlessGrid, useRangeSelection, useFillHandle } = require('@alaarab/ogrid-react') as typeof import('@alaarab/ogrid-react');

  const [data, setData] = useState<Person[]>(initialRows);
  const [lastFill, setLastFill] = useState('Drag the handle to fill');

  const grid = useHeadlessGrid({ columns, data, getRowId, initialPageSize: 10 });
  const range = useRangeSelection({ rowCount: grid.rows.length, colCount: grid.columns.length });
  const fill = useFillHandle<Person>({
    rangeSelection: range,
    rows: grid.rows,
    columns: grid.columns,
    onFillCells: useCallback((events) => {
      setData((prev) => events.reduce(applyChange, prev));
      setLastFill(`Filled ${events.length} cell${events.length === 1 ? '' : 's'}`);
    }, []),
  });

  // Releasing the mouse outside the table still commits the fill.
  const { isFilling, commitFill } = fill;
  useEffect(() => {
    if (!isFilling) return;
    window.addEventListener('mouseup', commitFill);
    return () => window.removeEventListener('mouseup', commitFill);
  }, [isFilling, commitFill]);

  const r = range.range;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span>{isFilling && fill.fillRange ? `Fill to R${fill.fillRange.endRow + 1}C${fill.fillRange.endCol + 1}` : r ? 'Grab the green square' : 'Select a cell first'}</span>
        <span className={styles.status}>{lastFill}</span>
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
            {grid.rows.map((row, rowIdx) => (
              <tr key={grid.getRowId(row)}>
                {grid.columns.map((col, colIdx) => {
                  const inRange = range.isInRange(rowIdx, colIdx);
                  const showHandle = !isFilling && r && rowIdx === r.endRow && colIdx === r.endCol;
                  const inFill = isFilling && fill.isInFillRange(rowIdx, colIdx) && !inRange;
                  return (
                    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: wiring pointer events to cells is the headless hook's integration point
                    <td
                      key={col.columnId}
                      className={[styles.td, isNumeric(col) ? styles.numeric : '', col.editable ? '' : styles.readonly, inRange ? styles.selected : '', inFill ? styles.fill : ''].join(' ')}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        if (e.shiftKey) range.extendRange(rowIdx, colIdx);
                        else range.startRange(rowIdx, colIdx);
                      }}
                      onMouseEnter={(e) => {
                        if (isFilling) fill.updateFill(rowIdx, colIdx);
                        else if (e.buttons === 1) range.extendRange(rowIdx, colIdx);
                      }}
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
    </div>
  );
}

export default function UseFillHandleDemo() {
  return (
    <LiveDemo height={440} title="Select cells, then drag the green square at the range's bottom-right corner down or across">
      {() => <Inner />}
    </LiveDemo>
  );
}
