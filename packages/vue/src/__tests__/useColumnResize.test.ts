import { ref } from 'vue';
import { measureColumnContentWidth } from '@alaarab/ogrid-core';
import { useColumnResize } from '../composables/useColumnResize';
import type { IColumnDef } from '../types';

jest.mock('@alaarab/ogrid-core', () => {
  const actual = jest.requireActual('@alaarab/ogrid-core');
  return {
    ...actual,
    measureColumnContentWidth: jest.fn(() => 200),
  };
});

const mockedMeasure = measureColumnContentWidth as jest.MockedFunction<typeof measureColumnContentWidth>;

type Row = { id: string; name: string };

describe('useColumnResize', () => {
  it('getColumnWidth returns override width when set', () => {
    const overrides = ref<Record<string, { widthPx: number }>>({
      name: { widthPx: 200 },
    });
    const { getColumnWidth } = useColumnResize<Row>({
      columnSizingOverrides: overrides,
      setColumnSizingOverrides: (v) => { overrides.value = v; },
    });

    const col = { columnId: 'name', name: 'Name' } as IColumnDef<Row>;
    expect(getColumnWidth(col)).toBe(200);
  });

  it('getColumnWidth returns idealWidth when no override', () => {
    const overrides = ref<Record<string, { widthPx: number }>>({});
    const { getColumnWidth } = useColumnResize<Row>({
      columnSizingOverrides: overrides,
      setColumnSizingOverrides: (v) => { overrides.value = v; },
    });

    const col = { columnId: 'name', name: 'Name', idealWidth: 180 } as IColumnDef<Row>;
    expect(getColumnWidth(col)).toBe(180);
  });

  it('getColumnWidth returns defaultWidth when no override or idealWidth', () => {
    const overrides = ref<Record<string, { widthPx: number }>>({});
    const { getColumnWidth } = useColumnResize<Row>({
      columnSizingOverrides: overrides,
      setColumnSizingOverrides: (v) => { overrides.value = v; },
    });

    const col = { columnId: 'name', name: 'Name', defaultWidth: 150 } as IColumnDef<Row>;
    expect(getColumnWidth(col)).toBe(150);
  });

  it('getColumnWidth falls back to default 120 when no widths specified', () => {
    const overrides = ref<Record<string, { widthPx: number }>>({});
    const { getColumnWidth } = useColumnResize<Row>({
      columnSizingOverrides: overrides,
      setColumnSizingOverrides: (v) => { overrides.value = v; },
    });

    const col = { columnId: 'name', name: 'Name' } as IColumnDef<Row>;
    expect(getColumnWidth(col)).toBe(120);
  });

  it('getColumnWidth uses custom defaultWidth param', () => {
    const overrides = ref<Record<string, { widthPx: number }>>({});
    const { getColumnWidth } = useColumnResize<Row>({
      columnSizingOverrides: overrides,
      setColumnSizingOverrides: (v) => { overrides.value = v; },
      defaultWidth: 200,
    });

    const col = { columnId: 'name', name: 'Name' } as IColumnDef<Row>;
    expect(getColumnWidth(col)).toBe(200);
  });

  describe('handleResizeDoubleClick', () => {
    const mockColumn = { columnId: 'name', name: 'Name' } as IColumnDef<Row>;

    // Build a real DOM structure: container > table > th > resizeHandle
    // so that closest('th') and closest('table')?.parentElement work
    let container: HTMLDivElement;
    let resizeHandle: HTMLSpanElement;

    beforeEach(() => {
      container = document.createElement('div');
      const table = document.createElement('table');
      const th = document.createElement('th');
      resizeHandle = document.createElement('span');
      th.appendChild(resizeHandle);
      table.appendChild(th);
      container.appendChild(table);

      mockedMeasure.mockClear();
      mockedMeasure.mockReturnValue(200);
    });

    function createDoubleClickEvent(): PointerEvent {
      const event = new MouseEvent('dblclick', { bubbles: true }) as unknown as PointerEvent;
      // Override currentTarget since it's read-only on real events  - 
      // define it as a property pointing to our resizeHandle element
      Object.defineProperty(event, 'currentTarget', { value: resizeHandle });
      // Override preventDefault and stopPropagation so we can assert on them
      event.preventDefault = jest.fn();
      event.stopPropagation = jest.fn();
      return event;
    }

    it('handleResizeDoubleClick calls measureColumnContentWidth and updates overrides', () => {
      const overrides = ref<Record<string, { widthPx: number }>>({});
      const setOverrides = jest.fn((v: Record<string, { widthPx: number }>) => { overrides.value = v; });
      const { handleResizeDoubleClick } = useColumnResize<Row>({
        columnSizingOverrides: overrides,
        setColumnSizingOverrides: setOverrides,
      });

      const event = createDoubleClickEvent();
      handleResizeDoubleClick(event, mockColumn);

      expect(mockedMeasure).toHaveBeenCalledWith('name', 80, container);
      expect(setOverrides).toHaveBeenCalledTimes(1);
      expect(setOverrides).toHaveBeenCalledWith({ name: { widthPx: 200 } });
    });

    it('handleResizeDoubleClick calls onColumnResized callback', () => {
      const overrides = ref<Record<string, { widthPx: number }>>({});
      const onColumnResized = jest.fn();
      mockedMeasure.mockReturnValue(175);

      const { handleResizeDoubleClick } = useColumnResize<Row>({
        columnSizingOverrides: overrides,
        setColumnSizingOverrides: (v) => { overrides.value = v; },
        onColumnResized,
      });

      const event = createDoubleClickEvent();
      handleResizeDoubleClick(event, mockColumn);

      expect(onColumnResized).toHaveBeenCalledWith('name', 175);
    });

    it('handleResizeDoubleClick prevents default and stops propagation', () => {
      const overrides = ref<Record<string, { widthPx: number }>>({});
      const { handleResizeDoubleClick } = useColumnResize<Row>({
        columnSizingOverrides: overrides,
        setColumnSizingOverrides: (v) => { overrides.value = v; },
      });

      const event = createDoubleClickEvent();
      handleResizeDoubleClick(event, mockColumn);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });
});
