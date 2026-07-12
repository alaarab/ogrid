import { createGridContextMenu, type StyledGridContextMenuProps } from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';

export type GridContextMenuProps = StyledGridContextMenuProps;

export const GridContextMenu = createGridContextMenu(styles);
