import { calculateDropTarget, moveColumnByStep, reorderColumnArray } from '../columnReorder';
import { getColumnHeaderMenuItems } from '../gridContextMenuHelpers';

/** Header cells laid out left to right, each 100px wide, plus matching body cells. */
function buildTable(ids: string[], withBody = false): HTMLElement {
  const table = document.createElement('table');
  const tr = document.createElement('tr');
  ids.forEach((id, i) => {
    const th = document.createElement('th');
    th.setAttribute('data-column-id', id);
    th.getBoundingClientRect = () =>
      ({ left: i * 100, right: i * 100 + 100, width: 100, top: 0, bottom: 30, height: 30, x: i * 100, y: 0, toJSON() {} }) as DOMRect;
    tr.appendChild(th);
  });
  table.appendChild(tr);
  if (withBody) {
    const bodyRow = document.createElement('tr');
    for (const id of ids) {
      const td = document.createElement('td');
      td.setAttribute('data-column-id', id);
      td.getBoundingClientRect = () => {
        throw new Error('body cells must not be measured');
      };
      bodyRow.appendChild(td);
    }
    table.appendChild(bodyRow);
  }
  return table;
}

/** Drop `dragged` with the pointer at `mouseX` and return the resulting order. */
function drop(order: string[], dragged: string, mouseX: number): string[] {
  const result = calculateDropTarget({
    mouseX,
    columnOrder: order,
    draggedColumnId: dragged,
    draggedPinState: 'unpinned',
    tableElement: buildTable(order),
  });
  if (!result) throw new Error('no drop target');
  return reorderColumnArray(order, dragged, result.targetIndex);
}

describe('calculateDropTarget + reorderColumnArray', () => {
  const order = ['A', 'B', 'C', 'D'];

  it('moves a column one slot right (drop in the B|C gap)', () => {
    expect(drop(order, 'A', 160)).toEqual(['B', 'A', 'C', 'D']);
  });

  it('moves a column two slots right (drop in the C|D gap)', () => {
    expect(drop(order, 'A', 260)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('moves a column to the end (drop past the last midpoint)', () => {
    expect(drop(order, 'A', 390)).toEqual(['B', 'C', 'D', 'A']);
  });

  it('moves a column left (drop in the A|B gap)', () => {
    expect(drop(order, 'D', 60)).toEqual(['A', 'D', 'B', 'C']);
  });

  it('moves a column to the start', () => {
    expect(drop(order, 'C', 10)).toEqual(['C', 'A', 'B', 'D']);
  });

  it('treats the gaps on either side of the dragged column as no-ops', () => {
    for (const mouseX of [110, 160]) {
      const result = calculateDropTarget({
        mouseX,
        columnOrder: order,
        draggedColumnId: 'B',
        draggedPinState: 'unpinned',
        tableElement: buildTable(order),
      });
      expect(result?.indicatorX).toBeNull();
      expect(reorderColumnArray(order, 'B', result?.targetIndex ?? -1)).toEqual(order);
    }
  });

  it('only measures header cells, not body cells', () => {
    expect(() =>
      calculateDropTarget({
        mouseX: 160,
        columnOrder: order,
        draggedColumnId: 'A',
        draggedPinState: 'unpinned',
        tableElement: buildTable(order, true),
      })
    ).not.toThrow();
  });
});

describe('moveColumnByStep', () => {
  const order = ['A', 'B', 'C', 'D'];
  const move = (columnId: string, direction: 'left' | 'right', extra: Partial<Parameters<typeof moveColumnByStep>[0]> = {}) =>
    moveColumnByStep({ columnOrder: order, displayedColumnIds: order, columnId, direction, ...extra });

  it('swaps a column with its displayed neighbor', () => {
    expect(move('B', 'left')).toEqual(['B', 'A', 'C', 'D']);
    expect(move('B', 'right')).toEqual(['A', 'C', 'B', 'D']);
  });

  it('returns null at either edge', () => {
    expect(move('A', 'left')).toBeNull();
    expect(move('D', 'right')).toBeNull();
  });

  it('steps past hidden columns, which keep their place', () => {
    // C is hidden: moving B right lands it after D, and moving D left lands it before B.
    const shown = ['A', 'B', 'D'];
    expect(move('B', 'right', { displayedColumnIds: shown })).toEqual(['A', 'C', 'D', 'B']);
    expect(move('D', 'left', { displayedColumnIds: shown })).toEqual(['A', 'D', 'B', 'C']);
    expect(move('C', 'left', { displayedColumnIds: shown })).toBeNull();
  });

  it('never crosses a pin zone boundary', () => {
    const pinnedColumns = { left: ['A'], right: ['D'] };
    expect(move('B', 'left', { pinnedColumns })).toBeNull();
    expect(move('C', 'right', { pinnedColumns })).toBeNull();
    expect(move('B', 'right', { pinnedColumns })).toEqual(['A', 'C', 'B', 'D']);
  });

  it('places columns missing from a partial order after the listed ones', () => {
    expect(move('D', 'left', { columnOrder: ['B', 'A'], displayedColumnIds: ['B', 'A', 'C', 'D'] })).toEqual(['B', 'A', 'D', 'C']);
  });
});

describe('header menu reorder items', () => {
  const base = { canPinLeft: true, canPinRight: true, canUnpin: false };

  it('offers Move left / Move right only when reordering is on', () => {
    expect(getColumnHeaderMenuItems(base).some((i) => i.id === 'moveLeft')).toBe(false);
    const items = getColumnHeaderMenuItems({ ...base, canReorder: true, canMoveLeft: false, canMoveRight: true });
    const left = items.find((i) => i.id === 'moveLeft');
    const right = items.find((i) => i.id === 'moveRight');
    expect(left).toMatchObject({ label: 'Move left', disabled: true });
    expect(right).toMatchObject({ label: 'Move right', disabled: false });
  });
});
