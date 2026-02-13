import { ref } from 'vue';
import { useColumnPinning } from '../composables/useColumnPinning';
import type { IColumnDef } from '../types';

type Row = { id: string; name: string; status: string };

const columns = ref([
  { columnId: 'id', name: 'ID' },
  { columnId: 'name', name: 'Name' },
  { columnId: 'status', name: 'Status' },
] as IColumnDef<Row>[]);

describe('useColumnPinning', () => {
  it('initializes with empty pinned columns', () => {
    const { pinnedColumns } = useColumnPinning({ columns });
    expect(Object.keys(pinnedColumns.value)).toHaveLength(0);
  });

  it('initializes from column.pinned definitions', () => {
    const colsWithPinned = ref([
      { columnId: 'id', name: 'ID', pinned: 'left' as const },
      { columnId: 'name', name: 'Name' },
      { columnId: 'status', name: 'Status', pinned: 'right' as const },
    ] as IColumnDef<Row>[]);

    const { pinnedColumns } = useColumnPinning({ columns: colsWithPinned });
    expect(pinnedColumns.value).toEqual({ id: 'left', status: 'right' });
  });

  it('pinColumn pins a column to left', () => {
    const { pinnedColumns, pinColumn } = useColumnPinning({ columns });
    pinColumn('name', 'left');
    expect(pinnedColumns.value.name).toBe('left');
  });

  it('pinColumn pins a column to right', () => {
    const { pinnedColumns, pinColumn } = useColumnPinning({ columns });
    pinColumn('status', 'right');
    expect(pinnedColumns.value.status).toBe('right');
  });

  it('unpinColumn removes pinning', () => {
    const { pinnedColumns, pinColumn, unpinColumn } = useColumnPinning({ columns });
    pinColumn('name', 'left');
    expect(pinnedColumns.value.name).toBe('left');

    unpinColumn('name');
    expect(pinnedColumns.value.name).toBeUndefined();
  });

  it('isPinned returns the pinned side', () => {
    const { isPinned, pinColumn } = useColumnPinning({ columns });
    pinColumn('name', 'left');
    expect(isPinned('name')).toBe('left');
    expect(isPinned('status')).toBeUndefined();
  });

  it('calls onColumnPinned callback when pinning', () => {
    const onColumnPinned = jest.fn();
    const { pinColumn } = useColumnPinning({ columns, onColumnPinned });
    pinColumn('name', 'left');
    expect(onColumnPinned).toHaveBeenCalledWith('name', 'left');
  });

  it('calls onColumnPinned callback when unpinning', () => {
    const onColumnPinned = jest.fn();
    const { pinColumn, unpinColumn } = useColumnPinning({ columns, onColumnPinned });
    pinColumn('name', 'left');
    unpinColumn('name');
    expect(onColumnPinned).toHaveBeenCalledWith('name', null);
  });

  it('uses controlled pinnedColumns when provided', () => {
    const controlled = ref<Record<string, 'left' | 'right'>>({ id: 'left' });
    const { pinnedColumns } = useColumnPinning({
      columns,
      pinnedColumns: controlled,
    });
    expect(pinnedColumns.value).toEqual({ id: 'left' });
  });

  describe('computeLeftOffsets', () => {
    it('computes left offsets for pinned columns', () => {
      const { pinColumn, computeLeftOffsets } = useColumnPinning({ columns });
      pinColumn('id', 'left');
      pinColumn('name', 'left');

      const visibleCols = [
        { columnId: 'id' },
        { columnId: 'name' },
        { columnId: 'status' },
      ];
      const widths = { id: 80, name: 120, status: 100 };
      const offsets = computeLeftOffsets(visibleCols, widths, 100, false, 40);

      expect(offsets.id).toBe(0);
      expect(offsets.name).toBe(80);
      expect(offsets.status).toBeUndefined();
    });

    it('accounts for checkbox column in left offsets', () => {
      const { pinColumn, computeLeftOffsets } = useColumnPinning({ columns });
      pinColumn('id', 'left');

      const visibleCols = [{ columnId: 'id' }, { columnId: 'name' }];
      const widths = { id: 80, name: 120 };
      const offsets = computeLeftOffsets(visibleCols, widths, 100, true, 40);

      expect(offsets.id).toBe(40); // after checkbox column
    });
  });

  describe('computeRightOffsets', () => {
    it('computes right offsets for pinned columns', () => {
      const { pinColumn, computeRightOffsets } = useColumnPinning({ columns });
      pinColumn('status', 'right');

      const visibleCols = [
        { columnId: 'id' },
        { columnId: 'name' },
        { columnId: 'status' },
      ];
      const widths = { id: 80, name: 120, status: 100 };
      const offsets = computeRightOffsets(visibleCols, widths, 100);

      expect(offsets.status).toBe(0);
    });

    it('stacks multiple right-pinned columns', () => {
      const { pinColumn, computeRightOffsets } = useColumnPinning({ columns });
      pinColumn('name', 'right');
      pinColumn('status', 'right');

      const visibleCols = [
        { columnId: 'id' },
        { columnId: 'name' },
        { columnId: 'status' },
      ];
      const widths = { id: 80, name: 120, status: 100 };
      const offsets = computeRightOffsets(visibleCols, widths, 100);

      expect(offsets.status).toBe(0);
      expect(offsets.name).toBe(100); // after status column
    });
  });
});
