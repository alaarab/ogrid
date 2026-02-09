import * as React from 'react';
import { getStatusBarParts } from '@alaarab/ogrid-core';
import styles from './DataGridTable.module.scss';

export interface StatusBarProps {
  totalCount: number;
  filteredCount?: number;
  selectedCount?: number;
  selectedCellCount?: number;
}

export function StatusBar(props: StatusBarProps): React.ReactElement {
  const parts = getStatusBarParts(props);
  return (
    <div className={styles.statusBar} role="status" aria-live="polite">
      {parts.map((p) => (
        <span key={p.key} className={styles.statusBarItem}>
          <span className={styles.statusBarLabel}>{p.label}</span>
          <span className={styles.statusBarValue}>{p.value.toLocaleString()}</span>
        </span>
      ))}
    </div>
  );
}
