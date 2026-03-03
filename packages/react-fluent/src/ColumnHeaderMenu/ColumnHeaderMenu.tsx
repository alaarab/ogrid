import React from 'react';
import { BaseColumnHeaderMenu } from '@alaarab/ogrid-react';
import type { BaseColumnHeaderMenuProps } from '@alaarab/ogrid-react';
import styles from './ColumnHeaderMenu.module.scss';

export type ColumnHeaderMenuProps = Omit<BaseColumnHeaderMenuProps, 'classNames' | 'getPortalTarget'>;

/** Portal into the closest FluentProvider so --ogrid-* bridged variables are available */
const getFluentPortalTarget = (anchorElement: HTMLElement): HTMLElement =>
  (anchorElement.closest('.fui-FluentProvider') as HTMLElement) ?? document.body;

/**
 * Column header dropdown menu for pin/sort/autosize actions.
 * Thin wrapper over BaseColumnHeaderMenu  -  portals into FluentProvider.
 */
export function ColumnHeaderMenu(props: ColumnHeaderMenuProps) {
  return (
    <BaseColumnHeaderMenu
      {...props}
      classNames={styles}
      getPortalTarget={getFluentPortalTarget}
    />
  );
}
