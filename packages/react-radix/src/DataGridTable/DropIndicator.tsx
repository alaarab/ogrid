import * as React from 'react';
import styles from './DataGridTable.module.scss';

interface DropIndicatorProps {
  dropIndicatorX: number;
  wrapperLeft: number;
}

export function DropIndicator({ dropIndicatorX, wrapperLeft }: DropIndicatorProps): React.ReactElement {
  return (
    <div
      className={styles.dropIndicator}
      style={{ left: dropIndicatorX - wrapperLeft }}
    />
  );
}
