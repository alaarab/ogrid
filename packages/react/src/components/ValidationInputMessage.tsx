import * as React from 'react';
import type { DataGridPrimitives, DataGridStyles } from './BaseDataGridTable.types';

export interface ValidationInputMessageProps {
  message: { title?: string; text?: string };
  styles: DataGridStyles;
  primitives: DataGridPrimitives;
}

const Message = React.lazy(() => import('./CellNotePopoverContent').then(m => ({ default: m.ValidationInputMessage })));

/** Keep prompt positioning and portal UI off grids without input messages. */
export function ValidationInputMessage(props: ValidationInputMessageProps): React.ReactElement {
  return <React.Suspense fallback={null}><Message {...props} /></React.Suspense>;
}
