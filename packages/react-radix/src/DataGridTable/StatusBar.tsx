import * as React from 'react';
import { StatusBar as BaseStatusBar } from '@alaarab/ogrid-react';
import type { StatusBarProps as BaseStatusBarProps } from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';

export type StatusBarProps = Omit<BaseStatusBarProps, 'classNames'>;

const statusBarClassNames = {
  statusBar: styles.statusBar,
  statusBarItem: styles.statusBarItem,
  statusBarLabel: styles.statusBarLabel,
  statusBarValue: styles.statusBarValue,
};

export function StatusBar(props: StatusBarProps): React.ReactElement {
  return <BaseStatusBar {...props} classNames={statusBarClassNames} />;
}
