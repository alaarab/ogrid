import * as React from 'react';
import { createPortal } from 'react-dom';
import { usePortalTheme } from '../hooks/usePortalTheme';
import type { UseCellNotesResult } from '../hooks/useCellNotes';
import type { CellNotePopoverRenderProps, DataGridPrimitives, DataGridStyles } from './BaseDataGridTable.types';

export interface CellNotePopoverProps {
  notes: UseCellNotesResult<unknown>;
  /** Grid wrapper: source of the theme tokens copied onto the portaled popover. */
  wrapperRef: React.RefObject<HTMLElement | null>;
  /** Id of the viewer, referenced by the cell's aria-describedby. */
  viewId: string;
  styles: DataGridStyles;
  primitives: DataGridPrimitives;
}

/** Fallback popover when the adapter has no `renderCellNotePopover`: a fixed box below the cell. */
function FallbackNotePopover({ anchorEl, content }: CellNotePopoverRenderProps): React.ReactElement {
  const rect = anchorEl.getBoundingClientRect();
  return createPortal(
    <div style={{ position: 'fixed', left: rect.right, top: rect.top, zIndex: 'var(--ogrid-z-popover, 10001)' as unknown as number }}>
      {content}
    </div>,
    document.body
  );
}

function NoteEditor({
  initialText, isNew, onSave, onCancel, textRef, styles,
}: {
  initialText: string;
  isNew: boolean;
  onSave: (text: string) => void;
  onCancel: () => void;
  /** Mirrors the current text, so a dismiss (outside click) can save it. */
  textRef: React.MutableRefObject<string>;
  styles: DataGridStyles;
}): React.ReactElement {
  const [text, setText] = React.useState(initialText);
  textRef.current = text;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  return (
    <div className={styles.cellNote} role="dialog" aria-label={isNew ? 'New note' : 'Edit note'}>
      <textarea
        ref={textareaRef}
        className={styles.cellNoteTextarea}
        aria-label="Note text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSave(text);
          }
        }}
      />
      <div className={styles.cellNoteActions}>
        <button type="button" className={styles.cellNoteButton} onClick={onCancel}>Cancel</button>
        <button type="button" className={`${styles.cellNoteButton ?? ''} ${styles.cellNoteButtonPrimary ?? ''}`.trim()} onClick={() => onSave(text)}>
          Save
        </button>
      </div>
    </div>
  );
}

/**
 * The cell-note popover: the note (author + text) on hover/focus, or the note
 * editor. Each kit draws the surface with its own popover primitive.
 */
export function CellNotePopover({ notes, wrapperRef, viewId, styles, primitives }: CellNotePopoverProps): React.ReactElement | null {
  const { popover, closePopover, commitNote, onPopoverPointerEnter, onPopoverPointerLeave } = notes;
  const theme = usePortalTheme(wrapperRef, popover != null);
  const editTextRef = React.useRef('');
  if (!popover) return null;
  const { mode, note, anchor } = popover;
  if (mode === 'view' && !note) return null;

  const body = mode === 'edit'
    ? (
      <NoteEditor
        // A different cell starts a fresh editor.
        key={`${String(popover.rowId)}\u0000${popover.columnId}`}
        initialText={note?.text ?? ''}
        isNew={!note}
        onSave={(text) => commitNote(text)}
        onCancel={() => closePopover(true)}
        textRef={editTextRef}
        styles={styles}
      />
    )
    : (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: hover tracking only, so the note stays open while the pointer moves onto it
      <div
        id={viewId}
        className={styles.cellNote}
        role="tooltip"
        data-ogrid-cell-note=""
        onMouseEnter={onPopoverPointerEnter}
        onMouseLeave={onPopoverPointerLeave}
      >
        {note?.author && <div className={styles.cellNoteAuthor}>{note.author}</div>}
        <div className={styles.cellNoteText}>{note?.text}</div>
      </div>
    );
  const content = <div style={theme}>{body}</div>;
  const render = primitives.renderCellNotePopover ?? FallbackNotePopover;
  return (
    <>
      {render({
        open: true,
        anchorEl: anchor,
        mode,
        onDismiss: () => (mode === 'edit' ? commitNote(editTextRef.current, false) : closePopover()),
        onEscape: () => closePopover(mode === 'edit'),
        content,
      })}
    </>
  );
}
