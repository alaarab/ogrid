/**
 * Shared tests for Excel-style cell notes: corner marker, aria description,
 * hover popover, the note editor (context menu, Shift+F2), undo/redo, and notes
 * following their row through sort, filter and paging. Each UI package calls
 * createCellNotesTests(OGrid).
 */
import * as React from 'react';
import { render, fireEvent, act, screen, waitFor } from '@testing-library/react';
import type { IOGridProps, IOGridApi, IColumnDef, ICellNote } from '../types';

interface Row {
  id: number;
  name: string;
  qty: number;
}

const rows: Row[] = [
  { id: 1, name: 'Apple', qty: 3 },
  { id: 2, name: 'Banana', qty: 1 },
  { id: 3, name: 'Cherry', qty: 2 },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'qty', name: 'Qty', type: 'numeric', sortable: true },
];

type GridOverrides = Partial<IOGridProps<Row>>;
type OGridComponent = React.ForwardRefExoticComponent<IOGridProps<Row> & React.RefAttributes<IOGridApi<Row>>>;

export function createCellNotesTests(OGrid: OGridComponent): void {
  function renderGrid(overrides: GridOverrides = {}) {
    const props = {
      columns,
      data: rows,
      getRowId: (r: Row) => r.id,
      defaultPageSize: 10,
      ...overrides,
    } as IOGridProps<Row>;
    return render(<OGrid {...props} />);
  }

  function td(container: HTMLElement, rowId: number, columnId: string): HTMLElement {
    const el = container.querySelector(`tr[data-row-id="${rowId}"] td[data-column-id="${columnId}"]`);
    if (!el) throw new Error(`No cell for row ${rowId}, column ${columnId}`);
    return el as HTMLElement;
  }
  const hasMarker = (container: HTMLElement, rowId: number, columnId: string) =>
    td(container, rowId, columnId).querySelector('[data-ogrid-note-indicator]') != null;
  const markedCells = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('td[data-note-row-id]')).map(
      (el) => `${el.getAttribute('data-note-row-id')}:${el.getAttribute('data-column-id')}`
    );

  function activate(container: HTMLElement, rowId: number, columnId: string): HTMLElement {
    const cell = td(container, rowId, columnId).querySelector('[data-row-index]') as HTMLElement;
    fireEvent.pointerDown(cell);
    fireEvent.mouseDown(cell, { button: 0 });
    fireEvent.mouseUp(cell, { button: 0 });
    return cell;
  }
  async function openContextMenu(container: HTMLElement, rowId: number, columnId: string) {
    const cell = activate(container, rowId, columnId);
    fireEvent.contextMenu(cell, { clientX: 100, clientY: 100 });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
  }
  function gridKey(container: HTMLElement, init: KeyboardEventInit) {
    const grid = container.querySelector('[role="region"]') as HTMLElement;
    act(() => {
      grid.focus();
      fireEvent.keyDown(grid, init);
    });
  }
  async function saveEditor(text: string) {
    const textarea = await screen.findByRole('textbox', { name: 'Note text' });
    fireEvent.change(textarea, { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  }

  const notes: ICellNote[] = [
    { rowId: 2, columnId: 'name', text: 'Check supplier', author: 'Ala' },
    { rowId: 3, columnId: 'qty', text: 'Low stock' },
  ];

  describe('display', () => {
    it('marks noted cells and describes them for assistive tech', () => {
      const { container } = renderGrid({ cellNotes: notes });
      expect(markedCells(container).sort()).toEqual(['2:name', '3:qty']);
      const cell = td(container, 2, 'name');
      const descId = cell.getAttribute('aria-describedby');
      expect(descId).toBeTruthy();
      expect(document.getElementById(descId as string)?.textContent).toBe('Note: Check supplier');
      expect(td(container, 1, 'name').getAttribute('aria-describedby')).toBeNull();
    });

    it('notes follow their row through sorting', () => {
      const { container, rerender } = renderGrid({ cellNotes: notes });
      expect(hasMarker(container, 2, 'name')).toBe(true);
      rerender(
        <OGrid
          {...({ columns, data: rows, getRowId: (r: Row) => r.id, defaultPageSize: 10, cellNotes: notes, sort: { field: 'qty', direction: 'asc' } } as IOGridProps<Row>)}
        />
      );
      const order = Array.from(container.querySelectorAll('tbody tr[data-row-id]')).map((tr) => tr.getAttribute('data-row-id'));
      expect(order).toEqual(['2', '3', '1']);
      expect(hasMarker(container, 2, 'name')).toBe(true);
      expect(hasMarker(container, 3, 'qty')).toBe(true);
      expect(hasMarker(container, 1, 'name')).toBe(false);
    });

    it('hides notes whose row is on another page or whose column is hidden', () => {
      const paged = renderGrid({ cellNotes: notes, defaultPageSize: 2 } as GridOverrides);
      expect(markedCells(paged.container)).toEqual(['2:name']);
      paged.unmount();
      const hidden = renderGrid({ cellNotes: notes, visibleColumns: new Set(['qty']) });
      expect(markedCells(hidden.container)).toEqual(['3:qty']);
    });

    it('shows the note on hover and hides it when the pointer leaves', async () => {
      const { container } = renderGrid({ cellNotes: notes });
      const cell = td(container, 2, 'name');
      fireEvent.mouseOver(cell);
      const tip = await screen.findByRole('tooltip');
      expect(tip.textContent).toContain('Ala');
      expect(tip.textContent).toContain('Check supplier');
      fireEvent.mouseOut(cell, { relatedTarget: document.body });
      // The note closes after a short delay (so the pointer can move onto it).
      await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
      expect(document.querySelector('[role="tooltip"]')).toBeNull();
    });

    it('shows the note when its cell takes keyboard focus', async () => {
      const { container } = renderGrid({ cellNotes: notes });
      act(() => td(container, 3, 'qty').focus());
      expect((await screen.findByRole('tooltip')).textContent).toContain('Low stock');
    });
  });

  describe('editing', () => {
    it('has no note items in the context menu when notes are read-only', async () => {
      const { container } = renderGrid({ cellNotes: notes });
      await openContextMenu(container, 2, 'name');
      expect(screen.queryByRole('menuitem', { name: /note/i })).not.toBeInTheDocument();
    });

    it('New note from the context menu adds a note (uncontrolled) and reports it', async () => {
      const onCellNotesChange = jest.fn();
      const { container } = renderGrid({ cellNotesEditable: true, cellNoteAuthor: 'Ala', onCellNotesChange });
      await openContextMenu(container, 1, 'qty');
      expect(screen.queryByRole('menuitem', { name: /Edit note/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('menuitem', { name: /New note/ }));
      expect(await screen.findByRole('dialog', { name: 'New note' })).toBeInTheDocument();
      await saveEditor('Recount');
      expect(onCellNotesChange).toHaveBeenCalledTimes(1);
      const saved = onCellNotesChange.mock.calls[0]?.[0] as ICellNote[];
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ rowId: 1, columnId: 'qty', text: 'Recount', author: 'Ala' });
      expect(typeof saved[0]?.createdAt).toBe('string');
      expect(hasMarker(container, 1, 'qty')).toBe(true);
    });

    it('Edit note and Delete note act on the active cell (controlled)', async () => {
      function Harness() {
        const [value, setValue] = React.useState<ICellNote[]>(notes);
        return (
          <OGrid
            {...({ columns, data: rows, getRowId: (r: Row) => r.id, cellNotes: value, onCellNotesChange: setValue } as IOGridProps<Row>)}
          />
        );
      }
      const { container } = render(<Harness />);
      await openContextMenu(container, 2, 'name');
      expect(screen.queryByRole('menuitem', { name: /New note/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('menuitem', { name: /Edit note/ }));
      const textarea = await screen.findByRole('textbox', { name: 'Note text' });
      expect((textarea as HTMLTextAreaElement).value).toBe('Check supplier');
      await saveEditor('Supplier confirmed');
      fireEvent.mouseOver(td(container, 2, 'name'));
      expect((await screen.findByRole('tooltip')).textContent).toContain('Supplier confirmed');

      await openContextMenu(container, 2, 'name');
      fireEvent.click(screen.getByRole('menuitem', { name: /Delete note/ }));
      await waitFor(() => expect(hasMarker(container, 2, 'name')).toBe(false));
      expect(hasMarker(container, 3, 'qty')).toBe(true);
    });

    it('Shift+F2 opens the editor on the active cell; Escape discards changes', async () => {
      const onCellNotesChange = jest.fn();
      const { container } = renderGrid({ cellNotes: notes, onCellNotesChange });
      activate(container, 3, 'qty');
      act(() => {
        fireEvent.keyDown(td(container, 3, 'qty'), { key: 'F2', shiftKey: true });
      });
      const textarea = await screen.findByRole('textbox', { name: 'Note text' });
      // Typing in the note editor never reaches the grid (no type-to-replace cell edit).
      fireEvent.keyDown(textarea, { key: 'x' });
      expect(container.querySelector('[data-ogrid-cell-editor]')).toBeNull();
      fireEvent.change(textarea, { target: { value: 'changed' } });
      fireEvent.keyDown(textarea, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(onCellNotesChange).not.toHaveBeenCalled();
    });

    it('saving empty text deletes the note', async () => {
      const onCellNotesChange = jest.fn();
      const { container } = renderGrid({ cellNotes: notes, onCellNotesChange });
      activate(container, 2, 'name');
      act(() => {
        fireEvent.keyDown(td(container, 2, 'name'), { key: 'F2', shiftKey: true });
      });
      await saveEditor('   ');
      expect(onCellNotesChange.mock.calls[0]?.[0]).toEqual([notes[1]]);
    });

    it('note edits are undoable with Ctrl+Z and redoable with Ctrl+Y', async () => {
      const { container } = renderGrid({ cellNotesEditable: true });
      await openContextMenu(container, 1, 'name');
      fireEvent.click(screen.getByRole('menuitem', { name: /New note/ }));
      await saveEditor('First');
      expect(hasMarker(container, 1, 'name')).toBe(true);
      gridKey(container, { key: 'z', ctrlKey: true });
      expect(hasMarker(container, 1, 'name')).toBe(false);
      gridKey(container, { key: 'y', ctrlKey: true });
      expect(hasMarker(container, 1, 'name')).toBe(true);
    });
  });
}
