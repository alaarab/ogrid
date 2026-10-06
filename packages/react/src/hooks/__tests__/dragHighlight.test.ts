import { renderHook, act } from '@testing-library/react';
import { useCellSelection } from '../useCellSelection';
import { useFillHandleInternal } from '../useFillHandleInternal';
import type { IColumnDef } from '../../types';

// DOM highlighting of the two pointer drags (drag-select and drag-fill): the
// live range is shown with data attributes, without React renders.

function makeGrid(rows: number, cols: number) {
  const wrapper = document.createElement('div');
  const cells = new Map<string, HTMLElement>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const el = document.createElement('div');
      el.setAttribute('data-row-index', String(r));
      el.setAttribute('data-col-index', String(c));
      wrapper.appendChild(el);
      cells.set(`${r},${c}`, el);
    }
  }
  document.body.appendChild(wrapper);
  let pointed: Element | null = null;
  const original = document.elementFromPoint;
  document.elementFromPoint = () => pointed;
  const marked = (attr: string) =>
    [...cells.entries()].filter(([, el]) => el.hasAttribute(attr)).map(([key]) => key).sort();
  return {
    wrapper,
    marked,
    pointTo: (r: number, c: number) => { pointed = cells.get(`${r},${c}`) ?? null; },
    cleanup: () => { document.elementFromPoint = original; wrapper.remove(); },
  };
}

const frame = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 40)); });
const pointer = (type: string) => act(() => { window.dispatchEvent(new MouseEvent(type, { clientX: 1, clientY: 1 })); });

describe('drag highlighting', () => {
  it('drag-select marks the live range and its anchor, follows a shrink, and clears after release', async () => {
    const grid = makeGrid(4, 3);
    try {
      // Stable like the real setter: a new one each render would restart the drag effect.
      const setActiveCell = () => {};
      const wrapperRef = { current: grid.wrapper };
      const { result } = renderHook(() =>
        useCellSelection({ colOffset: 1, rowCount: 4, visibleColCount: 2, setActiveCell, wrapperRef }),
      );
      const down = { button: 0, shiftKey: false, preventDefault: () => {} } as unknown as React.MouseEvent;
      act(() => result.current.handleCellMouseDown(down, 1, 1));
      expect(grid.marked('data-drag-anchor')).toEqual(['1,1']);
      expect(grid.marked('data-drag-range')).toEqual(['1,1']);

      grid.pointTo(3, 2);
      pointer('pointermove');
      await frame();
      expect(grid.marked('data-drag-range')).toEqual(['1,1', '1,2', '2,1', '2,2', '3,1', '3,2']);
      expect(grid.marked('data-drag-anchor')).toEqual(['1,1']);

      grid.pointTo(2, 1);
      pointer('pointermove');
      await frame();
      expect(grid.marked('data-drag-range')).toEqual(['1,1', '2,1']);

      pointer('pointerup');
      await frame();
      expect(grid.marked('data-drag-range')).toEqual([]);
      expect(grid.marked('data-drag-anchor')).toEqual([]);
      expect(result.current.selectionRange).toEqual({ startRow: 1, startCol: 0, endRow: 2, endCol: 0 });
    } finally {
      grid.cleanup();
    }
  });

  it('drag-fill marks the one-axis fill range while dragging and clears on release', async () => {
    type Item = { id: string; a: number; b: number };
    const items: Item[] = [0, 1, 2, 3].map((n) => ({ id: String(n), a: n, b: n }));
    const cols = [
      { columnId: 'a', name: 'A', type: 'numeric', editable: true },
      { columnId: 'b', name: 'B', type: 'numeric', editable: true },
    ] as IColumnDef<Item>[];
    const grid = makeGrid(4, 3);
    try {
      const { result } = renderHook(() =>
        useFillHandleInternal<Item>({
          items, visibleCols: cols, editable: true, onCellValueChanged: () => {},
          selectionRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
          setSelectionRange: () => {}, setActiveCell: () => {}, colOffset: 1,
          wrapperRef: { current: grid.wrapper as HTMLDivElement },
        }),
      );
      const down = { button: 0, preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.MouseEvent;
      act(() => result.current.handleFillHandleMouseDown(down));
      grid.pointTo(2, 2);
      pointer('pointermove');
      await frame();
      // Row distance 2 beats column distance 1: fills down column a (DOM column 1).
      expect(grid.marked('data-drag-range')).toEqual(['0,1', '1,1', '2,1']);
      expect(grid.marked('data-drag-anchor')).toEqual([]);

      grid.pointTo(0, 2);
      pointer('pointermove');
      await frame();
      expect(grid.marked('data-drag-range')).toEqual(['0,1', '0,2']);

      pointer('pointerup');
      expect(grid.marked('data-drag-range')).toEqual([]);
    } finally {
      grid.cleanup();
    }
  });
});
