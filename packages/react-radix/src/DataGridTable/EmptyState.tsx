import * as React from 'react';
import { BaseEmptyState } from '@alaarab/ogrid-react';
import type { BaseEmptyStateProps } from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';

interface EmptyStateProps {
  emptyState: BaseEmptyStateProps['emptyState'];
}

const classNames = {
  emptyStateInGrid: styles.emptyStateInGrid,
  emptyStateInGridTitle: styles.emptyStateInGridTitle,
  emptyStateInGridMessage: styles.emptyStateInGridMessage,
  emptyStateInGridLink: styles.emptyStateInGridLink,
};

export function EmptyState({ emptyState }: EmptyStateProps): React.ReactElement {
  return <BaseEmptyState emptyState={emptyState} classNames={classNames} />;
}
