import { ref } from 'vue';
import { useRowSelection } from '../composables/useRowSelection';
import type { RowId } from '../types';

type Row = { id: string; name: string };

const items: Row[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Carol' },
  { id: '4', name: 'Dave' },
];

const getRowId = (row: Row) => row.id;

describe('useRowSelection', () => {
  describe('single mode', () => {
    it('initializes with empty selection', () => {
      const { selectedRowIds } = useRowSelection({
        rowSelection: ref('single'),
        controlledSelectedRows: ref(undefined),
        items: ref(items),
        getRowId,
        onSelectionChange: undefined,
      });

      expect(selectedRowIds.value.size).toBe(0);
    });

    it('handleRowCheckboxChange selects single row', () => {
      const { selectedRowIds, handleRowCheckboxChange } = useRowSelection({
        rowSelection: ref('single'),
        controlledSelectedRows: ref(undefined),
        items: ref(items),
        getRowId,
        onSelectionChange: undefined,
      });

      handleRowCheckboxChange('1', true, 0, false);

      expect(selectedRowIds.value.has('1')).toBe(true);
      expect(selectedRowIds.value.size).toBe(1);
    });

    it('handleRowCheckboxChange deselects row', () => {
      const { selectedRowIds, handleRowCheckboxChange } = useRowSelection({
        rowSelection: ref('single'),
        controlledSelectedRows: ref(new Set(['1'])),
        items: ref(items),
        getRowId,
        onSelectionChange: undefined,
      });

      handleRowCheckboxChange('1', false, 0, false);

      expect(selectedRowIds.value.has('1')).toBe(false);
      expect(selectedRowIds.value.size).toBe(0);
    });
  });

  describe('multiple mode', () => {
    it('allows multiple selections', () => {
      const { selectedRowIds, handleRowCheckboxChange } = useRowSelection({
        rowSelection: ref('multiple'),
        controlledSelectedRows: ref(undefined),
        items: ref(items),
        getRowId,
        onSelectionChange: undefined,
      });

      handleRowCheckboxChange('1', true, 0, false);
      handleRowCheckboxChange('2', true, 1, false);

      expect(selectedRowIds.value.has('1')).toBe(true);
      expect(selectedRowIds.value.has('2')).toBe(true);
      expect(selectedRowIds.value.size).toBe(2);
    });

    it('shift-click selects range', () => {
      const { selectedRowIds, handleRowCheckboxChange } = useRowSelection({
        rowSelection: ref('multiple'),
        controlledSelectedRows: ref(undefined),
        items: ref(items),
        getRowId,
        onSelectionChange: undefined,
      });

      // Select first row
      handleRowCheckboxChange('1', true, 0, false);

      // Shift-click on row 3 should select rows 1, 2, 3
      handleRowCheckboxChange('3', true, 2, true);

      expect(selectedRowIds.value.has('1')).toBe(true);
      expect(selectedRowIds.value.has('2')).toBe(true);
      expect(selectedRowIds.value.has('3')).toBe(true);
      expect(selectedRowIds.value.size).toBe(3);
    });

    it('handleSelectAll selects all rows', () => {
      const { selectedRowIds, handleSelectAll } = useRowSelection({
        rowSelection: ref('multiple'),
        controlledSelectedRows: ref(undefined),
        items: ref(items),
        getRowId,
        onSelectionChange: undefined,
      });

      handleSelectAll(true);

      expect(selectedRowIds.value.size).toBe(4);
      expect(selectedRowIds.value.has('1')).toBe(true);
      expect(selectedRowIds.value.has('2')).toBe(true);
      expect(selectedRowIds.value.has('3')).toBe(true);
      expect(selectedRowIds.value.has('4')).toBe(true);
    });

    it('handleSelectAll deselects all rows', () => {
      const { selectedRowIds, handleSelectAll } = useRowSelection({
        rowSelection: ref('multiple'),
        controlledSelectedRows: ref(new Set(['1', '2', '3', '4'])),
        items: ref(items),
        getRowId,
        onSelectionChange: undefined,
      });

      handleSelectAll(false);

      expect(selectedRowIds.value.size).toBe(0);
    });

    it('allSelected is true when all rows selected', () => {
      const { allSelected } = useRowSelection({
        rowSelection: ref('multiple'),
        controlledSelectedRows: ref(new Set(['1', '2', '3', '4'])),
        items: ref(items),
        getRowId,
        onSelectionChange: undefined,
      });

      expect(allSelected.value).toBe(true);
    });

    it('allSelected is false when not all rows selected', () => {
      const { allSelected } = useRowSelection({
        rowSelection: ref('multiple'),
        controlledSelectedRows: ref(new Set(['1', '2'])),
        items: ref(items),
        getRowId,
        onSelectionChange: undefined,
      });

      expect(allSelected.value).toBe(false);
    });

    it('someSelected is true when some rows selected', () => {
      const { someSelected } = useRowSelection({
        rowSelection: ref('multiple'),
        controlledSelectedRows: ref(new Set(['1', '2'])),
        items: ref(items),
        getRowId,
        onSelectionChange: undefined,
      });

      expect(someSelected.value).toBe(true);
    });

    it('someSelected is false when no rows selected', () => {
      const { someSelected } = useRowSelection({
        rowSelection: ref('multiple'),
        controlledSelectedRows: ref(new Set<RowId>()),
        items: ref(items),
        getRowId,
        onSelectionChange: undefined,
      });

      expect(someSelected.value).toBe(false);
    });

    it('someSelected is false when all rows selected', () => {
      const { someSelected } = useRowSelection({
        rowSelection: ref('multiple'),
        controlledSelectedRows: ref(new Set(['1', '2', '3', '4'])),
        items: ref(items),
        getRowId,
        onSelectionChange: undefined,
      });

      expect(someSelected.value).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('calls onSelectionChange when selection changes', () => {
      const onSelectionChange = jest.fn();

      const { handleRowCheckboxChange } = useRowSelection({
        rowSelection: ref('multiple'),
        controlledSelectedRows: ref(undefined),
        items: ref(items),
        getRowId,
        onSelectionChange,
      });

      handleRowCheckboxChange('1', true, 0, false);

      expect(onSelectionChange).toHaveBeenCalled();
      expect(onSelectionChange.mock.calls[0][0].selectedRowIds).toEqual(['1']);
    });

    it('calls onSelectionChange when select all is triggered', () => {
      const onSelectionChange = jest.fn();

      const { handleSelectAll } = useRowSelection({
        rowSelection: ref('multiple'),
        controlledSelectedRows: ref(undefined),
        items: ref(items),
        getRowId,
        onSelectionChange,
      });

      handleSelectAll(true);

      expect(onSelectionChange).toHaveBeenCalled();
      expect(onSelectionChange.mock.calls[0][0].selectedRowIds.length).toBe(4);
    });
  });

  describe('controlled mode', () => {
    it('uses controlled selection when provided', () => {
      const controlledSelection = ref(new Set(['2', '3']));

      const { selectedRowIds } = useRowSelection({
        rowSelection: ref('multiple'),
        controlledSelectedRows: controlledSelection,
        items: ref(items),
        getRowId,
        onSelectionChange: undefined,
      });

      expect(selectedRowIds.value.has('2')).toBe(true);
      expect(selectedRowIds.value.has('3')).toBe(true);
      expect(selectedRowIds.value.size).toBe(2);
    });
  });
});
