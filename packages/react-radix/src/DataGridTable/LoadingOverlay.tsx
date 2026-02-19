import * as React from 'react';
import { BaseLoadingOverlay } from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';

interface LoadingOverlayProps {
  message: string;
}

const classNames = {
  loadingOverlay: styles.loadingOverlay,
  loadingOverlayContent: styles.loadingOverlayContent,
  spinner: styles.spinner,
  loadingOverlayText: styles.loadingOverlayText,
};

export function LoadingOverlay({ message }: LoadingOverlayProps): React.ReactElement {
  return <BaseLoadingOverlay message={message} classNames={classNames} />;
}
