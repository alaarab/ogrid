/**
 * Windowed (lazy) data source driven end to end through the Radix OGrid:
 * sort, filter, refresh and source swaps must re-request the visible rows and
 * repaint them, and keyboard navigation / copy must work over loaded rows.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { OGrid } from '../OGrid/OGrid';
import type { IColumnDef, IFilters, IOGridApi, IRowQueryContext, IRowWindowParams } from '@alaarab/ogrid-react';

interface Row {
  id: number;
  name: string;
}

const columns: IColumnDef<Row>[] = [{ columnId: 'name', name: 'Name', sortable: true }];
const getRowId = (r: Row) => r.id;

function makeRows(prefix: string, count = 100): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: i, name: `${prefix} ${String(i).padStart(3, '0')}` }));
}

/** A fake windowed source that sorts/filters an in-memory array per request. */
function makeSource(initial: Row[], { omitTotal = false } = {}) {
  let data = initial;
  const windowCalls: IRowWindowParams[] = [];
  const query = ({ sort, filters }: IRowQueryContext): Row[] => {
    let rows = data;
    const f = filters.name;
    if (f && f.type === 'text' && f.value) rows = rows.filter((r) => r.name.includes(f.value));
    if (sort?.field === 'name' && sort.direction === 'desc') rows = [...rows].reverse();
    return rows;
  };
  return {
    windowCalls,
    setData: (next: Row[]) => {
      data = next;
    },
    source: {
      async getRowCount(params: IRowQueryContext) {
        return query(params).length;
      },
      async getRows(params: IRowWindowParams) {
        windowCalls.push(params);
        const rows = query(params);
        const items = rows.slice(params.start, params.end);
        return omitTotal ? { items } : { items, totalCount: rows.length };
      },
    },
  };
}

/** Text of the first data cell in each rendered body row, in order. */
function firstColumnTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('tbody [data-row-index][data-col-index="0"]')).map(
    (el) => el.textContent ?? '',
  );
}

function getCell(container: HTMLElement, row: number): HTMLElement {
  const cell = container.querySelector(`tbody [data-row-index="${row}"][data-col-index="0"]`);
  if (!cell) throw new Error(`no cell at row ${row}`);
  return cell as HTMLElement;
}

const SORT_ASC = { field: 'name', direction: 'asc' as const };
const SORT_DESC = { field: 'name', direction: 'desc' as const };
const NO_FILTERS: IFilters = {};

describe('OGrid with a windowed data source', () => {
  // happy-dom has no layout; give elements a size so the virtualizer sees a
  // viewport and renders a window of rows.
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

  function Grid(props: {
    source: ReturnType<typeof makeSource>['source'];
    sort?: { field: string; direction: 'asc' | 'desc' };
    filters?: IFilters;
    gridRef?: React.Ref<IOGridApi<Row>>;
    statusBar?: boolean;
    rowSelection?: 'single' | 'multiple';
    onSelectionChange?: (e: { selectedRowIds: (string | number)[] }) => void;
  }) {
    return (
      <OGrid<Row>
        ref={props.gridRef}
        columns={columns}
        dataSource={props.source}
        getRowId={getRowId}
        sort={props.sort ?? SORT_ASC}
        onSortChange={() => {}}
        filters={props.filters ?? NO_FILTERS}
        onFiltersChange={() => {}}
        statusBar={props.statusBar}
        rowSelection={props.rowSelection}
        onSelectionChange={props.onSelectionChange}
      />
    );
  }

  it('re-requests and repaints the visible rows after a sort', async () => {
    const { source, windowCalls } = makeSource(makeRows('Name'));
    const { container, rerender } = render(<Grid source={source} />);
    await waitFor(() => expect(firstColumnTexts(container)[0]).toBe('Name 000'));

    const callsBefore = windowCalls.length;
    rerender(<Grid source={source} sort={SORT_DESC} />);

    // The window is fetched again with the new sort, and index 0 now shows the
    // new row (not a stuck placeholder, not the old row's cached value).
    await waitFor(() => expect(firstColumnTexts(container)[0]).toBe('Name 099'));
    expect(windowCalls.slice(callsBefore).some((c) => c.sort?.direction === 'desc' && c.start === 0)).toBe(true);
    expect(firstColumnTexts(container)[1]).toBe('Name 098');
    expect(container.querySelector('[data-windowed-row="loading"]')).toBeNull();
  });

  it('re-requests the visible rows after a filter and reports the new row count', async () => {
    const { source } = makeSource(makeRows('Name'));
    const { container, rerender } = render(<Grid source={source} />);
    await waitFor(() => expect(firstColumnTexts(container)[0]).toBe('Name 000'));

    rerender(<Grid source={source} filters={{ name: { type: 'text', value: 'Name 05' } }} />);
    await waitFor(() => expect(firstColumnTexts(container)).toEqual(
      Array.from({ length: 10 }, (_, i) => `Name 05${i}`),
    ));
    // One header row + 10 data rows.
    expect(container.querySelector('[role="grid"]')).toHaveAttribute('aria-rowcount', '11');
  });

  it('refreshData reloads the visible rows', async () => {
    const { source, setData } = makeSource(makeRows('Name'));
    const gridRef = React.createRef<IOGridApi<Row>>();
    const { container } = render(<Grid source={source} gridRef={gridRef} />);
    await waitFor(() => expect(firstColumnTexts(container)[0]).toBe('Name 000'));

    setData(makeRows('Fresh'));
    act(() => {
      gridRef.current?.refreshData();
    });
    await waitFor(() => expect(firstColumnTexts(container)[0]).toBe('Fresh 000'));
    expect(firstColumnTexts(container)[5]).toBe('Fresh 005');
  });

  it('keeps sort/filter context and row count when the data source is swapped', async () => {
    const a = makeSource(makeRows('A'));
    // B's window results omit totalCount: the count must come from getRowCount.
    const b = makeSource(makeRows('B'), { omitTotal: true });
    const { container, rerender } = render(<Grid source={a.source} sort={SORT_DESC} />);
    await waitFor(() => expect(firstColumnTexts(container)[0]).toBe('A 099'));

    rerender(<Grid source={b.source} sort={SORT_DESC} />);
    await waitFor(() => expect(firstColumnTexts(container)[0]).toBe('B 099'));
    expect(b.windowCalls.every((c) => c.sort?.direction === 'desc')).toBe(true);
    expect(container.querySelector('[role="grid"]')).toHaveAttribute('aria-rowcount', '101');
  });

  it('supports keyboard navigation and copy over loaded rows', async () => {
    const { source } = makeSource(makeRows('Name'));
    const { container } = render(<Grid source={source} />);
    await waitFor(() => expect(firstColumnTexts(container)[0]).toBe('Name 000'));

    fireEvent.pointerDown(getCell(container, 0));
    const grid = container.querySelector('[role="region"]') as HTMLElement;
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });

    // Copy reads the active cell, so 'Name 002' proves both moves landed.
    // Ctrl+C is left to the browser; the native copy event carries the text.
    const setData = jest.fn();
    const copy = new Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(copy, 'clipboardData', { value: { setData } });
    await act(async () => {
      fireEvent(grid, copy);
    });
    expect(setData).toHaveBeenCalledWith('text/plain', 'Name 002');
  });

  it('single row selection works on a row loaded after unloaded ones', async () => {
    const { source, windowCalls } = makeSource(makeRows('Name', 1000));
    const onSelectionChange = jest.fn();
    const { container } = render(<Grid source={source} rowSelection="single" onSelectionChange={onSelectionChange} />);
    await waitFor(() => expect(firstColumnTexts(container)[0]).toBe('Name 000'));

    // Scroll to the end: the last block loads while the rows in between stay
    // unloaded, so the loaded-rows array has holes before the clicked row.
    const scroller = container.querySelector('[role="region"]') as HTMLElement;
    act(() => {
      scroller.scrollTop = 999 * 36;
      fireEvent.scroll(scroller);
    });
    await waitFor(() => expect(windowCalls.some((c) => c.end >= 1000)).toBe(true));
    await waitFor(() => expect(firstColumnTexts(container)).toContain('Name 999'));
    const target = container.querySelector('tbody tr[data-row-id="999"]') as HTMLElement;
    expect(container.querySelector('tbody tr[data-row-id="500"]')).toBeNull();

    fireEvent.click(target);
    expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ selectedRowIds: [999] }));
  });

  it('hides pagination and does not offset row indices by page', async () => {
    const { source } = makeSource(makeRows('Name'));
    const { container } = render(<Grid source={source} />);
    await waitFor(() => expect(firstColumnTexts(container)[0]).toBe('Name 000'));
    expect(screen.queryByLabelText('Next page')).toBeNull();
    expect(container.querySelector('tbody tr[aria-rowindex]')).toHaveAttribute('aria-rowindex', '2');
  });

  it('announces loading once through a grid-level status region', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { source } = makeSource(makeRows('Name'));
    const slow = {
      getRowCount: source.getRowCount,
      async getRows(params: IRowWindowParams) {
        await gate;
        return source.getRows(params);
      },
    };
    const { container } = render(<Grid source={slow} />);
    await waitFor(() => expect(container.querySelector('[data-windowed-row="loading"]')).not.toBeNull());
    // Placeholder rows are aria-hidden and carry no live regions of their own.
    expect(container.querySelector('[data-windowed-row] [role="status"]')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Loading rows');

    await act(async () => {
      release?.();
    });
    await waitFor(() => expect(firstColumnTexts(container)[0]).toBe('Name 000'));
    expect(screen.getByRole('status')).toHaveTextContent('');
  });
});
