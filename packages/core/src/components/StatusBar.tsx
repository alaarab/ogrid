import * as React from 'react';
import { getStatusBarParts } from '../utils/statusBarHelpers';

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
