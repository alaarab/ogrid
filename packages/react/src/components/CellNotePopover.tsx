import * as React from 'react';
import type { CellNotePopoverProps } from './CellNotePopoverContent';

export type { CellNotePopoverProps } from './CellNotePopoverContent';
const Popover = React.lazy(() => import('./CellNotePopoverContent').then(m => ({ default: m.CellNotePopover })));

/** Defer the note viewer and editor until a note is opened. */
export function CellNotePopover(props: CellNotePopoverProps): React.ReactElement | null {
  if (!props.notes.popover) return null;
  return <React.Suspense fallback={null}><Popover {...props} /></React.Suspense>;
}
