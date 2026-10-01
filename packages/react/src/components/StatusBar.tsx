import * as React from 'react';
import { getStatusBarParts } from '../utils';

export interface StatusBarClassNames {
  statusBar?: string;
  statusBarItem?: string;
  statusBarLabel?: string;
  statusBarValue?: string;
}

export interface StatusBarProps {
  totalCount: number;
  filteredCount?: number;
  selectedCount?: number;
  selectedCellCount?: number;
  /** Aggregation values for selected numeric cells. */
  aggregation?: {
    sum: number;
    avg: number;
    min: number;
    max: number;
    count: number;
  } | null;
  suppressRowCount?: boolean;
  classNames?: StatusBarClassNames;
}

/** `aria-live="off"` keeps role="status" from re-announcing every selection/aggregate change (the active-cell live region covers navigation). */
export function StatusBar({ classNames, ...rest }: StatusBarProps): React.ReactElement {
  const parts = getStatusBarParts(rest);
  return (
    <div className={classNames?.statusBar} role="status" aria-live="off">
      {parts.map((p) => (
        <span key={p.key} className={classNames?.statusBarItem}>
          <span className={classNames?.statusBarLabel}>{p.label}</span>
          <span className={classNames?.statusBarValue}>{p.value.toLocaleString()}</span>
        </span>
      ))}
    </div>
  );
}
