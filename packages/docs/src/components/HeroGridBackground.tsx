import React from 'react';
import styles from './HeroGridBackground.module.scss';

const COLS = 8;
const ROWS = 10;
const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export default function HeroGridBackground() {
  return (
    <div className={styles.gridBg} aria-hidden="true">
      {/* Column headers */}
      <div className={styles.colHeaders}>
        <div className={styles.cornerCell} />
        {COL_LABELS.map((label) => (
          <div key={label} className={styles.colHeader}>{label}</div>
        ))}
      </div>

      {/* Rows */}
      <div className={styles.rowsContainer}>
        {Array.from({ length: ROWS }, (_, rowIdx) => (
          <div key={rowIdx} className={styles.row}>
            <div className={styles.rowNumber}>{rowIdx + 1}</div>
            {Array.from({ length: COLS }, (_, colIdx) => {
              const cellIdx = rowIdx * COLS + colIdx;
              return (
                <div
                  key={colIdx}
                  className={styles.cell}
                  style={{ '--cell-idx': cellIdx } as React.CSSProperties}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Moving selection rectangles */}
      <div className={styles.selection1} />
      <div className={styles.selection2} />
    </div>
  );
}
