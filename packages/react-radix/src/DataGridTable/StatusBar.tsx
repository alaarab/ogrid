import { createStatusBar, type StyledStatusBarProps } from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';

export type StatusBarProps = StyledStatusBarProps;

export const StatusBar = createStatusBar(styles);
