import * as React from 'react';
import type { FindReplacePanelProps } from '@alaarab/ogrid-react';
import styles from './FindReplacePanel.module.scss';

const Panel = React.lazy(() => import('./FindReplacePanelContent').then(m => ({ default: m.FindReplacePanel })));

/** Load the panel controls when Find or Replace is opened. */
export function FindReplacePanel(props: FindReplacePanelProps): React.ReactElement {
  return <React.Suspense fallback={<div className={styles.panel} aria-busy="true" />}><Panel {...props} /></React.Suspense>;
}
