import { render, fireEvent, act } from '@testing-library/react';
import { useGridFocus } from '../useGridFocus';
import type { UseGridFocusResult } from '../useGridFocus';

const ROWS = 3;
const COLS = 3;
const ROW_IDS = ['r0', 'r1', 'r2'];
const COL_IDS = ['a', 'b', 'c'];

function RovingGrid({ onFocusApi }: { onFocusApi?: (api: UseGridFocusResult) => void }) {
  const focus = useGridFocus({ rowCount: ROWS, colCount: COLS });
  onFocusApi?.(focus);
  return (
    <table role="grid" onKeyDown={focus.getKeyDownHandler()}>
      <tbody>
        {ROW_IDS.map((rowId, r) => (
          <tr key={rowId}>
            {COL_IDS.map((colId, c) => (
              <td key={colId} role="gridcell" data-testid={`c${r}${c}`} {...focus.getCellProps(r, c)}>
                {r},{c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const stops = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('td[tabindex="0"]')).map((el) => el.getAttribute('data-testid'));

describe('useGridFocus getCellProps (roving tabindex)', () => {
  it('makes the first cell the only tab stop before any cell is active', () => {
    const { container } = render(<RovingGrid />);
    expect(stops(container)).toEqual(['c00']);
    expect(container.querySelectorAll('td[tabindex="-1"]').length).toBe(ROWS * COLS - 1);
  });

  it('focusing a cell makes it active, and focus follows arrow keys', () => {
    let api: UseGridFocusResult | undefined;
    const { getByTestId, container } = render(<RovingGrid onFocusApi={(a) => { api = a; }} />);
    act(() => getByTestId('c00').focus());
    expect(api?.activeCell).toEqual({ row: 0, col: 0 });

    act(() => { fireEvent.keyDown(getByTestId('c00'), { key: 'ArrowRight' }); });
    expect(document.activeElement).toBe(getByTestId('c01'));
    act(() => { fireEvent.keyDown(getByTestId('c01'), { key: 'ArrowDown' }); });
    expect(document.activeElement).toBe(getByTestId('c11'));
    expect(stops(container)).toEqual(['c11']);

    act(() => getByTestId('c22').focus());
    expect(api?.activeCell).toEqual({ row: 2, col: 2 });
    expect(stops(container)).toEqual(['c22']);
  });

  it('does not steal focus when the active cell moves while focus is outside the grid', () => {
    let api: UseGridFocusResult | undefined;
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const { getByTestId } = render(<RovingGrid onFocusApi={(a) => { api = a; }} />);
    act(() => getByTestId('c00').focus());
    act(() => outside.focus());
    act(() => api?.setActiveCell({ row: 1, col: 1 }));
    expect(document.activeElement).toBe(outside);
    expect(getByTestId('c11').getAttribute('tabindex')).toBe('0');
    outside.remove();
  });
});
