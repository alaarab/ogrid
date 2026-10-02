import type { StatusBarPanel } from '@alaarab/ogrid-core';
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
  /** Which row panels to show (default: all applicable). */
  panels?: StatusBarPanel[];
  classNames?: StatusBarClassNames;
}

export function StatusBar({ classNames, ...rest }: StatusBarProps): React.ReactElement {
  const parts = getStatusBarParts(rest);
  return (
    <div className={classNames?.statusBar} role="status" aria-live="polite">
      {parts.map((p) => (
        <span key={p.key} className={classNames?.statusBarItem}>
          <span className={classNames?.statusBarLabel}>{p.label}</span>
          <span className={classNames?.statusBarValue}>{p.value.toLocaleString()}</span>
        </span>
      ))}
    </div>
  );
}
