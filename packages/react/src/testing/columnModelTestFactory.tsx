/**
 * Shared column-model tests (order, reorder, widths) run against each UI kit's
 * OGrid, so the kit's own header and body primitives are what gets checked.
 * Each UI package calls createColumnModelTests(OGrid) to run these.
 */
import * as React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
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
      const menuButton = container.querySelector('th[data-column-id="name"] button[aria-label="Column options"]');
      if (!menuButton) throw new Error('missing column options button');
      await dragHeader(menuButton, 90, 260);
      expect(onColumnOrderChange).not.toHaveBeenCalled();
      expect(headerIds(container)).toEqual(['name', 'status', 'id']);
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
      fireEvent.pointerDown(getByRole('separator', { name: 'Resize Name' }), { clientX: 100 });
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
      fireEvent.pointerDown(getByRole('separator', { name: 'Resize Name' }), { clientX: 100 });
      act(() => {
        document.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, bubbles: true }));
      });
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      });
      expect(onColumnResized).toHaveBeenCalledWith('name', 150);
    });
  });
}
