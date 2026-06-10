
import { BaseColumnHeaderMenu } from '@alaarab/ogrid-react';
import type { BaseColumnHeaderMenuProps } from '@alaarab/ogrid-react';
import styles from './ColumnHeaderMenu.module.scss';

export type ColumnHeaderMenuProps = Omit<BaseColumnHeaderMenuProps, 'classNames' | 'getPortalTarget'>;

/**
 * Column header dropdown menu for pin/sort/autosize actions.
 * Thin wrapper over BaseColumnHeaderMenu  -  portals to document.body.
 */
export function ColumnHeaderMenu(props: ColumnHeaderMenuProps) {
  return (
    <BaseColumnHeaderMenu
      {...props}
      classNames={styles}
    />
  );
}
