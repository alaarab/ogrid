import { useRef, useState } from 'react';
import { LiveDemo } from '../../LiveDemo';
import styles from './headless.module.css';
import { bigRows, columns, formatCell, getRowId, isNumeric } from './headlessDemoData';

const ROW_HEIGHT = 32;

function Inner() {
  const { useHeadlessGrid, useGridVirtualization } = require('@alaarab/ogrid-react') as typeof import('@alaarab/ogrid-react');

  const containerRef = useRef<HTMLDivElement>(null);
  const [jump, setJump] = useState('5000');

  // 'all' disables pagination so every filtered row is available to the window.
  const grid = useHeadlessGrid({ columns, data: bigRows, getRowId, initialPageSize: 'all' });
  const virt = useGridVirtualization({
    rowCount: grid.rows.length,
    rowHeight: ROW_HEIGHT,
    containerRef,
    overscan: 5,
  });

  const { startIndex, endIndex, offsetTop, offsetBottom } = virt.rowRange;
  const visible = grid.rows.slice(startIndex, endIndex + 1);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <label>
          Jump to row{' '}
          <input className={styles.input} style={{ width: 72 }} value={jump} onChange={(e) => setJump(e.target.value)} inputMode="numeric" />
        </label>
        <button type="button" className={styles.btn} onClick={() => virt.scrollToIndex(Math.max(0, Number(jump) - 1), 'center')}>
          scrollToIndex
        </button>
        <span className={styles.status}>
          Rendering {visible.length} of {grid.rows.length.toLocaleString()} rows ({startIndex + 1}–{endIndex + 1}) · active: {String(virt.isActive)}
        </span>
      </div>
      <div ref={containerRef} className={styles.scroll} onScroll={virt.onScroll}>
        <table className={styles.vtable}>
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
            {offsetTop > 0 ? (
              <tr>
                <td className={styles.spacer} colSpan={grid.columns.length} style={{ height: offsetTop }} />
              </tr>
            ) : null}
            {visible.map((row) => (
              <tr key={grid.getRowId(row)}>
                {grid.columns.map((col) => (
                  <td key={col.columnId} className={`${styles.vcell} ${isNumeric(col) ? styles.numeric : ''}`}>
                    {formatCell(col, grid.getCellValue(row, col.columnId), row)}
                  </td>
                ))}
              </tr>
            ))}
            {offsetBottom > 0 ? (
              <tr>
                <td className={styles.spacer} colSpan={grid.columns.length} style={{ height: offsetBottom }} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function UseGridVirtualizationDemo() {
  return (
    <LiveDemo height={460} title="10,000 rows in a plain <table>; only the visible window is in the DOM. Scroll, sort, or jump">
      {() => <Inner />}
    </LiveDemo>
  );
}
