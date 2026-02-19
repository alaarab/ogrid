import * as React from 'react';
import { BaseDropIndicator } from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';

interface DropIndicatorProps {
  dropIndicatorX: number;
  wrapperLeft: number;
}

export function DropIndicator({ dropIndicatorX, wrapperLeft }: DropIndicatorProps): React.ReactElement {
  return <BaseDropIndicator dropIndicatorX={dropIndicatorX} wrapperLeft={wrapperLeft} className={styles.dropIndicator} />;
}
