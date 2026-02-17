import * as React from 'react';
import { Spinner } from '@fluentui/react-components';
import styles from './DataGridTable.module.scss';

interface LoadingOverlayProps {
  message: string;
}

export function LoadingOverlay({ message }: LoadingOverlayProps): React.ReactElement {
  return (
    <div className={styles.loadingOverlay} aria-live="polite">
      <div className={styles.loadingOverlayContent}>
        <Spinner size="small" />
        <span className={styles.loadingOverlayText}>{message}</span>
      </div>
    </div>
  );
}
