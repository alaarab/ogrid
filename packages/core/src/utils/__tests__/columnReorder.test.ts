import { calculateDropTarget, reorderColumnArray } from '../columnReorder';

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
