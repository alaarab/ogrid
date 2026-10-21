/**
 * Shared column-model tests (order, reorder, widths) run against each UI kit's
 * OGrid, so the kit's own header and body primitives are what gets checked.
 * Each UI package calls createColumnModelTests(OGrid) to run these.
 */
import * as React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { fixtureRows, getRowId, type FixtureRow } from './fixtures';
import type { IColumnDef, IOGridApi, IOGridProps } from '../types';

type OGridComponent = React.ComponentType<IOGridProps<FixtureRow> & React.RefAttributes<IOGridApi<FixtureRow>>>;

const COL_WIDTH = 100;

const threeColumns: IColumnDef<FixtureRow>[] = [
  { columnId: 'name', name: 'Name', filterable: { type: 'text' } },
  { columnId: 'status', name: 'Status' },
  { columnId: 'id', name: 'Id' },
];

/** Leaf header cell ids, left to right. */
function headerIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('thead th[data-column-id]')).map(
    (th) => th.getAttribute('data-column-id') ?? ''
  );
}

/** Body cell ids of the first data row, left to right. */
function bodyIds(container: HTMLElement): string[] {
  const row = container.querySelector('tbody tr');
  return Array.from(row?.querySelectorAll('td[data-column-id]') ?? []).map(
    (td) => td.getAttribute('data-column-id') ?? ''
  );
}

function rect(left: number, width: number): DOMRect {
  return { left, right: left + width, width, top: 0, bottom: 30, height: 30, x: left, y: 0, toJSON() {} } as DOMRect;
}

/**
 * happy-dom has no layout. Lay header cells out left to right in DOM order,
 * COL_WIDTH px each, and give every other element a 1000px-wide box.
 */
function mockLayout(containerWidth = 1000): { mockRestore: () => void } {
  return jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.tagName === 'TH' && this.hasAttribute('data-column-id')) {
      const siblings = Array.from(this.parentElement?.querySelectorAll(':scope > th[data-column-id]') ?? []);
      return rect(siblings.indexOf(this) * COL_WIDTH, COL_WIDTH);
    }
    return rect(0, containerWidth);
  });
}

async function flushFrames(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
}

/** Drag a header from `fromX` to `toX` (client coordinates). */
async function dragHeader(target: Element, fromX: number, toX: number): Promise<void> {
  fireEvent.pointerDown(target, { button: 0, clientX: fromX });
  act(() => {
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: toX, bubbles: true }));
  });
  await flushFrames();
  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: toX, bubbles: true }));
  });
}

export function createColumnModelTests(OGrid: OGridComponent): void {
  function renderOGrid(overrides: Partial<IOGridProps<FixtureRow>> = {}, ref?: React.Ref<IOGridApi<FixtureRow>>) {
    const props = {
      data: fixtureRows,
      columns: threeColumns,
      getRowId,
      defaultPageSize: 10,
      ...overrides,
    } as IOGridProps<FixtureRow>;
    return render(<OGrid {...props} ref={ref} />);
  }

  describe('column model', () => {
    let layout: { mockRestore: () => void } | undefined;
    afterEach(() => {
      layout?.mockRestore();
      layout = undefined;
    });

    it('header leaf row follows a controlled columnOrder, matching the body', () => {
      const { container } = renderOGrid({ columnOrder: ['id', 'name', 'status'] });
      expect(headerIds(container)).toEqual(['id', 'name', 'status']);
      expect(bodyIds(container)).toEqual(['id', 'name', 'status']);
    });

    it('header leaf row drops responsively hidden columns, matching the body', () => {
      layout = mockLayout(400);
      const columns: IColumnDef<FixtureRow>[] = [
        { columnId: 'name', name: 'Name' },
        { columnId: 'status', name: 'Status', responsivePriority: 2 },
        { columnId: 'id', name: 'Id' },
      ];
      const { container } = renderOGrid({ columns, responsiveColumns: true });
      expect(bodyIds(container)).toEqual(['name', 'id']);
      expect(headerIds(container)).toEqual(['name', 'id']);
    });

    it('hides columns to fit with a header marker that brings one back and keeps it', () => {
      layout = mockLayout(400);
      const columns: IColumnDef<FixtureRow>[] = [
        { columnId: 'name', name: 'Name' },
        { columnId: 'status', name: 'Status', responsivePriority: 2 },
        { columnId: 'id', name: 'Id' },
      ];
      const onColumnVisibilityChange = jest.fn();
      const { container } = renderOGrid({
        columns, responsiveColumns: true, allowHiding: true,
        defaultColumnVisibility: { hidden: [], shown: [] }, onColumnVisibilityChange,
      });
      expect(bodyIds(container)).toEqual(['name', 'id']);
      const marker = container.querySelector('thead [data-hidden-gap]');
      if (!marker) throw new Error('missing hidden column marker');
      fireEvent.click(marker);
      expect(onColumnVisibilityChange).toHaveBeenLastCalledWith({ hidden: [], shown: ['status'] });
      expect(bodyIds(container)).toEqual(['name', 'status', 'id']);
      expect(headerIds(container)).toEqual(['name', 'status', 'id']);
    });

    it('uncontrolled drag reorder moves the column (no onColumnOrderChange)', async () => {
      layout = mockLayout();
      const { container } = renderOGrid({ columnReorder: true });
      const nameLabel = container.querySelector('th[data-column-id="name"] [data-header-label]');
      if (!nameLabel) throw new Error('missing name header label');
      // Drop Name in the Status|Id gap: one slot to the right.
      await dragHeader(nameLabel, 50, 160);
      expect(headerIds(container)).toEqual(['status', 'name', 'id']);
      expect(bodyIds(container)).toEqual(['status', 'name', 'id']);
    });

    it('drag reorder with onColumnOrderChange but no columnOrder reorders and reports', async () => {
      layout = mockLayout();
      const onColumnOrderChange = jest.fn();
      const { container } = renderOGrid({ columnReorder: true, onColumnOrderChange });
      const idHeader = container.querySelector('th[data-column-id="id"]');
      if (!idHeader) throw new Error('missing id header');
      await dragHeader(idHeader, 250, 10);
      expect(onColumnOrderChange).toHaveBeenCalledWith(['id', 'name', 'status']);
      expect(headerIds(container)).toEqual(['id', 'name', 'status']);
      expect(bodyIds(container)).toEqual(['id', 'name', 'status']);
    });

    it('pointerdown on a header button does not start a reorder drag', async () => {
      layout = mockLayout();
      const onColumnOrderChange = jest.fn();
      const { container } = renderOGrid({ columnReorder: true, onColumnOrderChange });
      const menuButton = container.querySelector('th[data-column-id="name"] button[aria-label="Name column options"]');
      if (!menuButton) throw new Error('missing column options button');
      await dragHeader(menuButton, 90, 260);
      expect(onColumnOrderChange).not.toHaveBeenCalled();
      expect(headerIds(container)).toEqual(['name', 'status', 'id']);
    });

    it('drag keeps an unpinned column out of a column-def pinned zone', async () => {
      layout = mockLayout();
      const columns: IColumnDef<FixtureRow>[] = [{ ...threeColumns[0]!, pinned: 'left' }, threeColumns[1]!, threeColumns[2]!];
      const onColumnOrderChange = jest.fn();
      const { container } = renderOGrid({ columns, columnReorder: true, onColumnOrderChange });
      const idHeader = container.querySelector('th[data-column-id="id"]');
      if (!idHeader) throw new Error('missing id header');
      // Dropped over the pinned Name column: lands at the start of the unpinned zone instead.
      await dragHeader(idHeader, 250, 10);
      expect(onColumnOrderChange).toHaveBeenCalledWith(['name', 'id', 'status']);
      expect(headerIds(container)).toEqual(['name', 'id', 'status']);
    });

    describe('keyboard reorder (header menu)', () => {
      /** Open a column's header menu from the keyboard and return its items by action id. */
      function openMenu(container: HTMLElement, columnName: string) {
        const trigger = container.querySelector<HTMLElement>(`button[aria-label="${columnName} column options"]`);
        if (!trigger) throw new Error(`missing ${columnName} options button`);
        act(() => {
          trigger.focus();
        });
        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        const item = (id: string) => document.querySelector<HTMLButtonElement>(`[role="menu"] [data-ogrid-menu-action="${id}"]`);
        return { trigger, moveLeft: item('moveLeft'), moveRight: item('moveRight') };
      }

      it('is not offered without columnReorder', () => {
        const { container } = renderOGrid();
        expect(openMenu(container, 'Name').moveRight).toBeNull();
      });

      it('Move right / Move left reorder the column and report the order', () => {
        const onColumnOrderChange = jest.fn();
        const { container } = renderOGrid({ columnReorder: true, onColumnOrderChange });
        const first = openMenu(container, 'Name');
        expect(first.moveLeft?.disabled).toBe(true);
        fireEvent.click(first.moveRight!);
        expect(onColumnOrderChange).toHaveBeenLastCalledWith(['status', 'name', 'id']);
        expect(headerIds(container)).toEqual(['status', 'name', 'id']);
        expect(bodyIds(container)).toEqual(['status', 'name', 'id']);
        const again = openMenu(container, 'Name');
        fireEvent.click(again.moveLeft!);
        expect(onColumnOrderChange).toHaveBeenLastCalledWith(['name', 'status', 'id']);
        expect(headerIds(container)).toEqual(['name', 'status', 'id']);
      });

      it('disables Move right at the end and follows a controlled columnOrder', () => {
        const onColumnOrderChange = jest.fn();
        const { container, rerender } = renderOGrid({ columnReorder: true, columnOrder: ['id', 'name', 'status'], onColumnOrderChange });
        expect(openMenu(container, 'Status').moveRight?.disabled).toBe(true);
        fireEvent.click(openMenu(container, 'Status').moveLeft!);
        expect(onColumnOrderChange).toHaveBeenLastCalledWith(['id', 'status', 'name']);
        // Controlled: the grid shows what the host passes, not its own guess.
        expect(headerIds(container)).toEqual(['id', 'name', 'status']);
        rerender(<OGrid data={fixtureRows} columns={threeColumns} getRowId={getRowId} defaultPageSize={10} columnReorder columnOrder={['id', 'status', 'name']} onColumnOrderChange={onColumnOrderChange} />);
        expect(headerIds(container)).toEqual(['id', 'status', 'name']);
      });

      it('steps over hidden columns, leaving them in place', () => {
        const onColumnOrderChange = jest.fn();
        const { container } = renderOGrid({
          columnReorder: true, onColumnOrderChange, columnVisibility: { hidden: ['status'], shown: [] },
        });
        expect(headerIds(container)).toEqual(['name', 'id']);
        fireEvent.click(openMenu(container, 'Name').moveRight!);
        expect(onColumnOrderChange).toHaveBeenLastCalledWith(['status', 'id', 'name']);
        expect(headerIds(container)).toEqual(['id', 'name']);
      });

      it('stays inside the pin zone', () => {
        const onColumnOrderChange = jest.fn();
        const columns: IColumnDef<FixtureRow>[] = [{ ...threeColumns[0]!, pinned: 'left' }, threeColumns[1]!, threeColumns[2]!];
        const { container } = renderOGrid({ columns, columnReorder: true, onColumnOrderChange });
        expect(openMenu(container, 'Status').moveLeft?.disabled).toBe(true);
        expect(openMenu(container, 'Name').moveRight?.disabled).toBe(true);
      });

      it('keeps group headers over their leaves when a leaf moves out of its group', () => {
        const columns = [
          { headerName: 'Person', children: [threeColumns[0]!, threeColumns[1]!] },
          threeColumns[2]!,
        ];
        const { container } = renderOGrid({ columns, columnReorder: true } as Partial<IOGridProps<FixtureRow>>);
        fireEvent.click(openMenu(container, 'Status').moveRight!);
        // Id is a top-level leaf spanning both header rows, so compare the body order only.
        expect(bodyIds(container)).toEqual(['name', 'id', 'status']);
        // The Person group splits into one header cell over Name and one over Status.
        const groups = Array.from(container.querySelectorAll('thead th[scope="colgroup"]')).map((th) => th.textContent);
        expect(groups).toEqual(['Person', 'Person']);
      });
    });

    it('applyColumnState({ columnWidths }) after mount changes the rendered width', () => {
      const ref = React.createRef<IOGridApi<FixtureRow>>();
      const { container } = renderOGrid({}, ref);
      act(() => {
        ref.current?.applyColumnState({ visibleColumns: ['name', 'status', 'id'], columnWidths: { status: 240 } });
      });
      const statusTh = container.querySelector<HTMLElement>('th[data-column-id="status"]');
      expect(statusTh?.style.width).toBe('240px');
      expect(ref.current?.getColumnState().columnWidths).toEqual({ status: 240 });
    });

    it('drag resize fires onColumnResized and reaches getColumnState', () => {
      layout = mockLayout();
      const ref = React.createRef<IOGridApi<FixtureRow>>();
      const onColumnResized = jest.fn();
      const { container, getByRole } = renderOGrid({ onColumnResized }, ref);
      fireEvent.pointerDown(getByRole('separator', { name: 'Resize column Name' }), { clientX: 100 });
      act(() => {
        document.dispatchEvent(new PointerEvent('pointermove', { clientX: 160, bubbles: true }));
      });
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      });
      expect(onColumnResized).toHaveBeenCalledWith('name', 160);
      expect(ref.current?.getColumnState().columnWidths).toEqual({ name: 160 });
      // The echoed width doesn't reset the widths locked at drag start.
      expect(container.querySelector<HTMLElement>('th[data-column-id="name"]')?.style.width).toBe('160px');
      expect(container.querySelector<HTMLElement>('th[data-column-id="status"]')?.style.width).toBe(`${COL_WIDTH}px`);
    });

    it('drag resize respects the column minWidth', () => {
      layout = mockLayout();
      const onColumnResized = jest.fn();
      const columns: IColumnDef<FixtureRow>[] = [{ columnId: 'name', name: 'Name', minWidth: 150 }, threeColumns[1]!];
      const { getByRole } = renderOGrid({ columns, onColumnResized });
      fireEvent.pointerDown(getByRole('separator', { name: 'Resize column Name' }), { clientX: 100 });
      act(() => {
        document.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, bubbles: true }));
      });
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      });
      expect(onColumnResized).toHaveBeenCalledWith('name', 150);
    });

    describe('keyboard resize', () => {
      const sizedColumns: IColumnDef<FixtureRow>[] = [
        { columnId: 'name', name: 'Name', defaultWidth: 140, minWidth: 60 },
        threeColumns[1]!,
        threeColumns[2]!,
      ];
      const nameTh = (container: HTMLElement) => container.querySelector<HTMLElement>('th[data-column-id="name"]');
      const focusHandle = (handle: HTMLElement) => {
        act(() => {
          handle.focus();
        });
        expect(document.activeElement).toBe(handle);
      };

      it('resize handle is a focusable separator exposing the column width range', () => {
        const { getByRole } = renderOGrid({ columns: sizedColumns });
        const handle = getByRole('separator', { name: 'Resize column Name' });
        expect(handle.getAttribute('tabindex')).toBe('0');
        expect(handle.getAttribute('aria-orientation')).toBe('vertical');
        expect(handle.getAttribute('aria-valuenow')).toBe('140');
        expect(handle.getAttribute('aria-valuemin')).toBe('60');
        expect(handle.hasAttribute('aria-valuemax')).toBe(false);
        expect(handle.hasAttribute('aria-hidden')).toBe(false);
      });

      it('ArrowRight widens the column by 10px through the resize callbacks', () => {
        layout = mockLayout();
        const ref = React.createRef<IOGridApi<FixtureRow>>();
        const onColumnResized = jest.fn();
        const { container, getByRole } = renderOGrid({ columns: sizedColumns, onColumnResized }, ref);
        const handle = getByRole('separator', { name: 'Resize column Name' });
        focusHandle(handle);
        fireEvent.keyDown(handle, { key: 'ArrowRight' });
        expect(onColumnResized).toHaveBeenCalledWith('name', COL_WIDTH + 10);
        expect(ref.current?.getColumnState().columnWidths?.name).toBe(COL_WIDTH + 10);
        expect(nameTh(container)?.style.width).toBe(`${COL_WIDTH + 10}px`);
        expect(handle.getAttribute('aria-valuenow')).toBe(String(COL_WIDTH + 10));
        // Other columns are locked at their rendered width, as with a pointer drag.
        expect(container.querySelector<HTMLElement>('th[data-column-id="status"]')?.style.width).toBe(`${COL_WIDTH}px`);
      });

      it('Shift+ArrowLeft narrows the column by 1px', () => {
        layout = mockLayout();
        const onColumnResized = jest.fn();
        const { container, getByRole } = renderOGrid({ columns: sizedColumns, onColumnResized });
        const handle = getByRole('separator', { name: 'Resize column Name' });
        focusHandle(handle);
        fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
        expect(onColumnResized).toHaveBeenCalledWith('name', COL_WIDTH - 1);
        expect(nameTh(container)?.style.width).toBe(`${COL_WIDTH - 1}px`);
      });

      it('Home snaps to the min width and ArrowLeft cannot go below it', () => {
        layout = mockLayout();
        const onColumnResized = jest.fn();
        const { container, getByRole } = renderOGrid({ columns: sizedColumns, onColumnResized });
        const handle = getByRole('separator', { name: 'Resize column Name' });
        focusHandle(handle);
        fireEvent.keyDown(handle, { key: 'Home' });
        expect(onColumnResized).toHaveBeenLastCalledWith('name', 60);
        expect(nameTh(container)?.style.width).toBe('60px');
        fireEvent.keyDown(handle, { key: 'ArrowLeft' });
        expect(onColumnResized).toHaveBeenCalledTimes(1);
        expect(nameTh(container)?.style.width).toBe('60px');
      });

      it('Escape restores the width from focus time and keeps focus on the handle', () => {
        layout = mockLayout();
        const onColumnResized = jest.fn();
        const { container, getByRole } = renderOGrid({ columns: sizedColumns, onColumnResized });
        const handle = getByRole('separator', { name: 'Resize column Name' });
        focusHandle(handle);
        fireEvent.keyDown(handle, { key: 'ArrowRight' });
        fireEvent.keyDown(handle, { key: 'ArrowRight' });
        expect(nameTh(container)?.style.width).toBe(`${COL_WIDTH + 20}px`);
        fireEvent.keyDown(handle, { key: 'Escape' });
        expect(nameTh(container)?.style.width).toBe(`${COL_WIDTH}px`);
        expect(onColumnResized).toHaveBeenLastCalledWith('name', COL_WIDTH);
        expect(document.activeElement).toBe(handle);
      });

      it('Enter commits and hands focus back to the grid', () => {
        layout = mockLayout();
        const { container, getByRole } = renderOGrid({ columns: sizedColumns });
        const handle = getByRole('separator', { name: 'Resize column Name' });
        focusHandle(handle);
        fireEvent.keyDown(handle, { key: 'ArrowRight' });
        fireEvent.keyDown(handle, { key: 'Enter' });
        expect(nameTh(container)?.style.width).toBe(`${COL_WIDTH + 10}px`);
        expect(document.activeElement).toBe(getByRole('region', { name: 'Data grid' }));
      });

      it('Arrow keys on the handle do not move the active cell', async () => {
        layout = mockLayout();
        const { container, getByRole } = renderOGrid({ columns: sizedColumns });
        const cell = (row: number, col: number) =>
          container.querySelector(`[data-row-index="${row}"][data-col-index="${col}"]`) as HTMLElement;
        fireEvent.pointerDown(cell(1, 0));
        await waitFor(() => expect(cell(1, 0).getAttribute('data-active-cell')).toBe('true'));
        const handle = getByRole('separator', { name: 'Resize column Name' });
        focusHandle(handle);
        for (const key of ['ArrowRight', 'ArrowLeft', 'Home']) {
          const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
          act(() => {
            handle.dispatchEvent(event);
          });
          expect(event.defaultPrevented).toBe(true);
        }
        expect(cell(1, 0).getAttribute('data-active-cell')).toBe('true');
        expect(cell(1, 1).getAttribute('data-active-cell')).not.toBe('true');
      });
    });
  });
}
