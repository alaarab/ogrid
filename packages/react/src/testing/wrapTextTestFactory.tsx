/**
 * Shared wrap text tests: wrapped cells, rows sized by content or a manual
 * height, multi-line editing (Alt+Enter), multi-line paste, and variable row
 * heights under virtual scrolling. Each UI package calls createWrapTextTests(OGrid).
 */
import * as React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import type { IColumnDef, IOGridProps } from '../types';

interface NoteRow {
  id: string;
  title: string;
  notes: string;
  wrap?: boolean;
}

const rows: NoteRow[] = [
  { id: 'r0', title: 'First', notes: 'one line' },
  { id: 'r1', title: 'Second', notes: 'line one\nline two' },
  { id: 'r2', title: 'Third', notes: 'short' },
];

const columns: IColumnDef<NoteRow>[] = [
  { columnId: 'title', name: 'Title', editable: true },
  { columnId: 'notes', name: 'Notes', editable: true, wrapText: true },
];

function cellAt(container: HTMLElement, rowId: string, columnId: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`tbody tr[data-row-id="${rowId}"] td[data-column-id="${columnId}"] [data-row-index]`);
  if (!el) throw new Error(`no cell ${rowId}/${columnId}`);
  return el;
}

function rowEl(container: HTMLElement, rowId: string): HTMLElement {
  return container.querySelector(`tbody tr[data-row-id="${rowId}"]`) as HTMLElement;
}

async function editorField(grid: HTMLElement, tag: 'input' | 'textarea'): Promise<HTMLInputElement | HTMLTextAreaElement> {
  return waitFor(() => {
    const el = grid.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-ogrid-cell-editor] ${tag}`);
    expect(el).toBeInTheDocument();
    return el as HTMLInputElement | HTMLTextAreaElement;
  });
}

function firePaste(target: Element, text: string): void {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (format: string) => (format === 'text/plain' || format === 'text' ? text : '') },
  });
  fireEvent(target, event);
}

export function createWrapTextTests(OGrid: React.ComponentType<IOGridProps<NoteRow>>): void {
  function renderGrid(overrides: Partial<IOGridProps<NoteRow>> = {}) {
    const onCellValueChanged = jest.fn();
    const props = {
      data: rows,
      columns,
      getRowId: (r: NoteRow) => r.id,
      editable: true,
      onCellValueChanged,
      ...overrides,
    } as IOGridProps<NoteRow>;
    const utils = render(<OGrid {...props} />);
    const grid = utils.container.querySelector('[role="region"]') as HTMLElement;
    const click = (rowId: string, columnId: string) => {
      fireEvent.pointerDown(cellAt(utils.container, rowId, columnId));
      grid.focus();
    };
    return { ...utils, grid, click, onCellValueChanged };
  }

  describe('wrap text', () => {
    it('cells of a wrapText column wrap and keep their line breaks; other columns do not', () => {
      const { container } = renderGrid();
      const notes = cellAt(container, 'r1', 'notes');
      expect(notes.hasAttribute('data-wrap-text')).toBe(true);
      expect(notes.textContent).toBe('line one\nline two');
      expect(cellAt(container, 'r1', 'title').hasAttribute('data-wrap-text')).toBe(false);
    });

    it('wrapText as a function wraps per row', () => {
      const perRow: IColumnDef<NoteRow>[] = [
        columns[0] as IColumnDef<NoteRow>,
        { columnId: 'notes', name: 'Notes', wrapText: (r) => r.id === 'r2' },
      ];
      const { container } = renderGrid({ columns: perRow });
      expect(cellAt(container, 'r2', 'notes').hasAttribute('data-wrap-text')).toBe(true);
      expect(cellAt(container, 'r1', 'notes').hasAttribute('data-wrap-text')).toBe(false);
    });

    it('rows size to their content unless they have a manual height, which wins', () => {
      const { container } = renderGrid({ rowHeights: { r1: 24 } });
      const manual = rowEl(container, 'r1');
      expect(manual.style.height).toBe('24px');
      // The manual height also caps the cells, so wrapped text is clipped instead of growing the row.
      expect(manual.hasAttribute('data-custom-height')).toBe(true);
      expect(manual.style.getPropertyValue('--ogrid-row-max-height')).toBe('24px');
      const auto = rowEl(container, 'r0');
      expect(auto.style.height).toBe('');
      expect(auto.hasAttribute('data-custom-height')).toBe(false);
    });
  });

  describe('multi-line editing', () => {
    it('Alt+Enter inserts a line break at the caret; Enter commits the multi-line text', async () => {
      const { grid, click, onCellValueChanged } = renderGrid();
      click('r0', 'title');
      fireEvent.keyDown(grid, { key: 'F2' });
      const input = await editorField(grid, 'input');
      input.setSelectionRange(3, 3);
      fireEvent.keyDown(input, { key: 'Enter', altKey: true });
      // The editor becomes a textarea holding the line break, caret after it.
      const area = (await editorField(grid, 'textarea')) as HTMLTextAreaElement;
      expect(area.value).toBe('Fir\nst');
      expect(area.selectionStart).toBe(4);
      expect(onCellValueChanged).not.toHaveBeenCalled();
      fireEvent.keyDown(area, { key: 'Enter' });
      await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(1));
      expect(onCellValueChanged.mock.calls[0]?.[0]).toMatchObject({ columnId: 'title', oldValue: 'First', newValue: 'Fir\nst' });
    });

    it('a wrapped cell edits in a textarea; Escape after Alt+Enter cancels the edit', async () => {
      const { grid, click, onCellValueChanged } = renderGrid();
      click('r0', 'notes');
      fireEvent.keyDown(grid, { key: 'F2' });
      const area = await editorField(grid, 'textarea');
      expect(area.value).toBe('one line');
      fireEvent.keyDown(area, { key: 'Enter', altKey: true });
      fireEvent.keyDown(area, { key: 'Escape' });
      await waitFor(() => expect(grid.querySelector('[data-ogrid-cell-editor]')).toBeNull());
      expect(onCellValueChanged).not.toHaveBeenCalled();
    });

    it('text that already has line breaks opens in a textarea', async () => {
      const { grid, click } = renderGrid({ columns: [columns[0] as IColumnDef<NoteRow>, { columnId: 'notes', name: 'Notes', editable: true }] });
      click('r1', 'notes');
      fireEvent.keyDown(grid, { key: 'F2' });
      expect((await editorField(grid, 'textarea')).value).toBe('line one\nline two');
    });

    it('in a textarea, formula autocomplete keeps Enter while its list is open; Alt+Enter still adds a line break', async () => {
      const { grid, click, onCellValueChanged } = renderGrid({ formulas: true });
      click('r0', 'notes');
      fireEvent.keyDown(grid, { key: 'F2' });
      const area = (await editorField(grid, 'textarea')) as HTMLTextAreaElement;
      const typeText = (text: string) => act(() => {
        fireEvent.change(area, { target: { value: text } });
        area.setSelectionRange(text.length, text.length);
        fireEvent.keyUp(area, { key: 'End' });
      });
      const suggestions = () => document.body.querySelector('[role="listbox"][aria-label="Formula suggestions"]');
      typeText('=sumi');
      await waitFor(() => expect(suggestions()).not.toBeNull());
      fireEvent.keyDown(area, { key: 'Enter', altKey: true });
      await waitFor(() => expect((grid.querySelector('[data-ogrid-cell-editor] textarea') as HTMLTextAreaElement).value).toBe('=sumi\n'));
      expect(onCellValueChanged).not.toHaveBeenCalled();
      typeText('=sumi');
      await waitFor(() => expect(suggestions()).not.toBeNull());
      fireEvent.keyDown(area, { key: 'Enter' });
      await waitFor(() => expect(area.value).toBe('=SUMIF('));
      expect(onCellValueChanged).not.toHaveBeenCalled();
      // List closed: Enter commits.
      typeText('=1+1');
      await waitFor(() => expect(suggestions()).toBeNull());
      fireEvent.keyDown(area, { key: 'Enter' });
      await waitFor(() => expect(grid.querySelector('[data-ogrid-cell-editor]')).toBeNull());
    });

    it('pasting a quoted multi-line cell fills one cell and keeps its line breaks', async () => {
      const { grid, click, onCellValueChanged } = renderGrid();
      click('r0', 'notes');
      await act(async () => {
        firePaste(grid, '"alpha\nbeta"');
      });
      expect(onCellValueChanged).toHaveBeenCalledTimes(1);
      expect(onCellValueChanged.mock.calls[0]?.[0]).toMatchObject({ columnId: 'notes', newValue: 'alpha\nbeta' });
    });
  });

  describe('row heights under virtual scrolling', () => {
    const many: NoteRow[] = Array.from({ length: 200 }, (_, i) => ({ id: `v${i}`, title: `t${i}`, notes: `n${i}` }));
    const virtualScroll = { enabled: true, rowHeight: 30, threshold: 10, paginate: false } as const;
    // happy-dom has no layout; give elements a size so the virtualizer sees a viewport.
    const sizes = { clientHeight: 360, offsetHeight: 360, offsetWidth: 800 };
    const originals = Object.keys(sizes).map((key) => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)] as const);
    beforeAll(() => {
      for (const [key, value] of Object.entries(sizes)) {
        Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => value });
      }
    });
    afterAll(() => {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
        else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
      }
    });

    it('a row with its own height renders at it, and the scroll height accounts for it', () => {
      const { container } = renderGrid({ data: many, columns: [columns[0] as IColumnDef<NoteRow>], virtualScroll, rowHeights: { v0: 90 } });
      expect(rowEl(container, 'v0').style.height).toBe('90px');
      const rendered = container.querySelectorAll('tbody tr[data-row-id]').length;
      expect(rendered).toBeGreaterThan(0);
      expect(rendered).toBeLessThan(200);
      // Rows past the window are a spacer: total (199 x 30 + 90) minus the rendered rows.
      const spacers = Array.from(container.querySelectorAll<HTMLElement>('tbody tr[aria-hidden]'));
      const spacerTotal = spacers.reduce((sum, tr) => sum + Number.parseFloat(tr.style.height || '0'), 0);
      expect(spacerTotal).toBe(199 * 30 + 90 - (90 + (rendered - 1) * 30));
    });

    it('rows can be resized from the row numbers while virtual scrolling', () => {
      const onRowResized = jest.fn();
      const { container } = renderGrid({ data: many, virtualScroll, rowResize: true, showRowNumbers: true, onRowResized });
      const handle = rowEl(container, 'v1').querySelector('[data-row-resize-handle]') as Element;
      expect(handle).toBeInTheDocument();
      fireEvent.pointerDown(handle, { button: 0, clientY: 0 });
      act(() => {
        document.dispatchEvent(new MouseEvent('pointermove', { clientY: 50, bubbles: true }));
      });
      act(() => {
        document.dispatchEvent(new MouseEvent('pointerup', { clientY: 50, bubbles: true }));
      });
      expect(onRowResized).toHaveBeenCalledWith('v1', 50);
      expect(rowEl(container, 'v1').style.height).toBe('50px');
    });
  });
}
