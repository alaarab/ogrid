import * as React from 'react';
import styles from './DataGridTable.module.scss';

interface LoadingOverlayProps {
  message: string;
}

export function LoadingOverlay({ message }: LoadingOverlayProps): React.ReactElement {
  return (
    <div className={styles.loadingOverlay} aria-live="polite">
      <div className={styles.loadingOverlayContent}>
        <div className={styles.spinner} />
        <span className={styles.loadingOverlayText}>{message}</span>
      </div>
    </div>
  );
}
