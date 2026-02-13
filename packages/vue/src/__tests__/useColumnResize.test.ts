import { ref } from 'vue';
import { useColumnResize } from '../composables/useColumnResize';
import type { IColumnDef } from '../types';

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
});
