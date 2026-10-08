import { useCallback, useMemo, useState } from 'react';
import { useLatestRef } from './useLatestRef';
import type { ICellNote, IOGridProps, IOGridDataGridProps } from '../types';

type CellNoteProps = Pick<IOGridDataGridProps<unknown>, 'cellNotes' | 'onCellNotesChange' | 'cellNotesEditable' | 'cellNoteAuthor'>;

/**
 * Cell notes for OGrid: controlled (`cellNotes`) or kept by the grid
 * (`defaultCellNotes`, or nothing) when editing is on. Returns the note props
 * DataGridTable receives.
 */
export function useOGridCellNotes<T>(
  props: Pick<IOGridProps<T>, 'cellNotes' | 'defaultCellNotes' | 'onCellNotesChange' | 'cellNotesEditable' | 'cellNoteAuthor'>,
): CellNoteProps {
  const { cellNotes, defaultCellNotes, onCellNotesChange, cellNoteAuthor } = props;
  const editable = props.cellNotesEditable ?? onCellNotesChange != null;
  const controlled = cellNotes !== undefined;
  const [internalNotes, setInternalNotes] = useState<ICellNote[] | undefined>(defaultCellNotes);
  const onChangeRef = useLatestRef(onCellNotesChange);
  const handleChange = useCallback(
    (next: ICellNote[]) => {
      if (!controlled) setInternalNotes(next);
      onChangeRef.current?.(next);
    },
    [controlled, onChangeRef]
  );
  const notes = controlled ? cellNotes : internalNotes;
  return useMemo(() => ({
    cellNotes: notes,
    onCellNotesChange: editable ? handleChange : undefined,
    cellNotesEditable: editable,
    cellNoteAuthor,
  }), [notes, editable, handleChange, cellNoteAuthor]);
}
