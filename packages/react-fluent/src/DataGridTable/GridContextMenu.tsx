import * as React from 'react';
import { GridContextMenu as BaseGridContextMenu } from '@alaarab/ogrid-react';
import type { GridContextMenuHandlerProps } from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';

export interface GridContextMenuProps extends GridContextMenuHandlerProps {
  x: number;
  y: number;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

const classNames = {
  contextMenu: styles.contextMenu,
  contextMenuItem: styles.contextMenuItem,
  contextMenuItemLabel: styles.contextMenuItemLabel,
  contextMenuItemShortcut: styles.contextMenuItemShortcut,
  contextMenuDivider: styles.contextMenuDivider,
};

export function GridContextMenu(props: GridContextMenuProps): React.ReactElement {
  return <BaseGridContextMenu {...props} classNames={classNames} />;
}
