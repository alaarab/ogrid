/**
 * Additional test coverage for JS package
 * Integration tests, memory leak tests, edge cases, and state unit tests
 */

import { GridState } from '../state/GridState';
import { SelectionState } from '../state/SelectionState';
import { RowSelectionState } from '../state/RowSelectionState';
import { HeaderFilterState } from '../state/HeaderFilterState';
import { SideBarState } from '../state/SideBarState';
import { EventEmitter } from '../state/EventEmitter';
import type { IColumnDef } from '../types/columnTypes';
import type { IDataSource } from '@alaarab/ogrid-core';

interface TestItem {
  id: number;
  name: string;
  value: number;
  category?: string;
}

const mockColumns: IColumnDef<TestItem>[] = [
  { columnId: 'id', name: 'ID' },
  { columnId: 'name', name: 'Name' },
  { columnId: 'value', name: 'Value', type: 'numeric' },
];

const mockData: TestItem[] = [
  { id: 1, name: 'Alice', value: 100 },
  { id: 2, name: 'Bob', value: 200 },
  { id: 3, name: 'Charlie', value: 300 },
];

describe('Integration Tests', () => {
  describe('GridState + SelectionState coordination', () => {
    it('should coordinate page changes with selection clearing', () => {
      const gridState = new GridState({
        columns: mockColumns,
        data: mockData,
        getRowId: (item) => item.id,
        page: 1,
        pageSize: 2,
      });

      const selectionState = new SelectionState();
      selectionState.setActiveCell({ rowIndex: 0, columnIndex: 0 });

      expect(selectionState.activeCell).toEqual({ rowIndex: 0, columnIndex: 0 });

      // When page changes, selection should be cleared
      gridState.setPage(2);
      selectionState.clearSelection();

      expect(selectionState.activeCell).toBeNull();
      expect(selectionState.selectionRange).toBeNull();
      expect(gridState.page).toBe(2);

      gridState.destroy();
    });

    it('should handle selection during filtering', () => {
      const gridState = new GridState({
        columns: mockColumns,
        data: mockData,
        getRowId: (item) => item.id,
      });

      const selectionState = new SelectionState();
      selectionState.setActiveCell({ rowIndex: 1, columnIndex: 1 });

      gridState.setFilter('name', { type: 'text', value: 'Alice' });

      const { items } = gridState.getProcessedItems();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Alice');

      // Selection is preserved (app can choose to clear it)
      expect(selectionState.activeCell).toEqual({ rowIndex: 1, columnIndex: 1 });

      gridState.destroy();
    });

    it('should handle selection during sorting', () => {
      const gridState = new GridState({
        columns: mockColumns,
        data: mockData,
        getRowId: (item) => item.id,
      });

      const selectionState = new SelectionState();
      selectionState.setActiveCell({ rowIndex: 0, columnIndex: 0 });

      gridState.setSort({ field: 'value', direction: 'desc' });

      const { items } = gridState.getProcessedItems();
      expect(items[0].value).toBe(300); // Charlie first

      expect(selectionState.activeCell).toEqual({ rowIndex: 0, columnIndex: 0 });

      gridState.destroy();
    });
  });

  describe('Multiple state changes', () => {
    it('should handle rapid state changes without race conditions', () => {
      const gridState = new GridState({
        columns: mockColumns,
        data: mockData,
        getRowId: (item) => item.id,
      });

      const selectionState = new SelectionState();
      let stateChangeCount = 0;

      const unsub = gridState.onStateChange(() => {
        stateChangeCount++;
      });

      gridState.setSort({ field: 'name', direction: 'asc' });
      gridState.setFilter('value', { type: 'text', value: '100' });
      gridState.setPage(2);
      selectionState.setActiveCell({ rowIndex: 0, columnIndex: 0 });

      expect(stateChangeCount).toBe(3); // sort, filter, page
      expect(selectionState.activeCell).toBeTruthy();

      unsub();
      gridState.destroy();
    });

    it('should maintain data consistency across filter + sort + pagination', () => {
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        value: (i + 1) * 10,
      }));

      const gridState = new GridState({
        columns: mockColumns,
        data: largeData,
        getRowId: (item) => item.id,
        pageSize: 10,
      });

      gridState.setFilter('value', { type: 'text', value: '5' });
      gridState.setSort({ field: 'value', direction: 'desc' });

      const { items, totalCount } = gridState.getProcessedItems();

      expect(totalCount).toBeGreaterThan(0);
      expect(totalCount).toBeLessThan(100);
      expect(items.length).toBeLessThanOrEqual(10);

      if (items.length > 1) {
        expect(items[0].value).toBeGreaterThanOrEqual(items[1].value);
      }

      gridState.destroy();
    });
  });

  describe('RowSelectionState + GridState', () => {
    it('should handle row selection with pagination', () => {
      const gridState = new GridState({
        columns: mockColumns,
        data: mockData,
        getRowId: (item) => item.id,
        pageSize: 2,
      });

      const rowSelectionState = new RowSelectionState<TestItem>(
        'multiple',
        (item) => item.id
      );

      rowSelectionState.handleRowCheckboxChange(
        mockData[0].id,
        true,
        0,
        false,
        mockData
      );
      expect(rowSelectionState.getSelectedRows(mockData)).toHaveLength(1);

      gridState.setPage(2);

      expect(rowSelectionState.getSelectedRows(mockData)).toHaveLength(1);

      gridState.destroy();
      rowSelectionState.destroy();
    });

    it('should handle select all with filtering', () => {
      const gridState = new GridState({
        columns: mockColumns,
        data: mockData,
        getRowId: (item) => item.id,
      });

      const rowSelectionState = new RowSelectionState<TestItem>(
        'multiple',
        (item) => item.id
      );

      gridState.setFilter('name', { type: 'text', value: 'Alice' });
      const { items } = gridState.getProcessedItems();

      rowSelectionState.handleSelectAll(true, items);
      expect(rowSelectionState.selectedRowIds.size).toBe(1);

      gridState.clearFilters();

      expect(rowSelectionState.selectedRowIds.size).toBe(1);

      gridState.destroy();
      rowSelectionState.destroy();
    });
  });
});

describe('Memory Leak Tests', () => {
  describe('Event listener cleanup', () => {
    it('should remove all GridState event listeners on destroy', () => {
      const gridState = new GridState({
        columns: mockColumns,
        data: mockData,
        getRowId: (item) => item.id,
      });

      const handler1 = jest.fn();
      const handler2 = jest.fn();

      gridState.onStateChange(handler1);
      gridState.onStateChange(handler2);

      gridState.setPage(2);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      gridState.destroy();

      gridState.setPage(3);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should remove SelectionState event listeners on destroy', () => {
      const selectionState = new SelectionState();
      const handler = jest.fn();

      selectionState.onSelectionChange(handler);

      selectionState.setActiveCell({ rowIndex: 0, columnIndex: 0 });
      expect(handler).toHaveBeenCalledTimes(1);

      selectionState.destroy();

      selectionState.setActiveCell({ rowIndex: 1, columnIndex: 1 });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support manual unsubscribe before destroy', () => {
      const selectionState = new SelectionState();
      const handler = jest.fn();

      const unsubscribe = selectionState.onSelectionChange(handler);

      selectionState.setActiveCell({ rowIndex: 0, columnIndex: 0 });
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      selectionState.setActiveCell({ rowIndex: 1, columnIndex: 1 });
      expect(handler).toHaveBeenCalledTimes(1);

      selectionState.destroy();
    });

    it('should clean up RowSelectionState event listeners', () => {
      const rowSelectionState = new RowSelectionState<TestItem>(
        'multiple',
        (item) => item.id
      );
      const handler = jest.fn();

      rowSelectionState.onRowSelectionChange(handler);

      rowSelectionState.handleRowCheckboxChange(mockData[0].id, true, 0, false, mockData);
      expect(handler).toHaveBeenCalledTimes(1);

      rowSelectionState.destroy();

      rowSelectionState.handleRowCheckboxChange(mockData[1].id, true, 1, false, mockData);
      // Handler should not be called after destroy
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('RAF cancellation', () => {
    it('should cancel pending RAF in SelectionState on destroy', () => {
      const selectionState = new SelectionState();
      const applyFn = jest.fn();

      selectionState.startDrag(0, 0);
      selectionState.updateDrag(1, 1, applyFn);

      selectionState.destroy();

      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          expect(applyFn).not.toHaveBeenCalled();
          resolve();
        });
      });
    });

    it('should cancel RAF when drag ends', () => {
      const selectionState = new SelectionState();
      const applyFn = jest.fn();

      selectionState.startDrag(0, 0);
      selectionState.updateDrag(1, 1, applyFn);

      selectionState.endDrag();

      expect(applyFn).not.toHaveBeenCalled();

      selectionState.destroy();
    });
  });

  describe('AbortController cleanup', () => {
    it('should abort in-flight fetch on GridState destroy', async () => {
      const mockDataSource: IDataSource<TestItem> = {
        fetchPage: jest.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({ items: mockData, totalCount: 2 });
            }, 100);
          });
        }),
      };

      const mockAbort = jest.fn();
      const originalAbortController = global.AbortController;

      global.AbortController = jest.fn().mockImplementation(() => ({
        signal: { aborted: false },
        abort: mockAbort,
      })) as never;

      const gridState = new GridState({
        columns: mockColumns,
        dataSource: mockDataSource,
        getRowId: (item) => item.id,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      gridState.destroy();

      expect(mockAbort).toHaveBeenCalled();

      global.AbortController = originalAbortController;
    });
  });

  describe('EventEmitter memory management', () => {
    it('should remove all listeners on removeAllListeners', () => {
      const emitter = new EventEmitter<{ test: string }>();
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('test', handler1);
      emitter.on('test', handler2);

      emitter.emit('test', 'value1');
      expect(handler1).toHaveBeenCalledWith('value1');
      expect(handler2).toHaveBeenCalledWith('value1');

      emitter.removeAllListeners();

      emitter.emit('test', 'value2');
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle removing specific event listeners', () => {
      const emitter = new EventEmitter<{ test: string; other: number }>();
      const testHandler = jest.fn();
      const otherHandler = jest.fn();

      emitter.on('test', testHandler);
      emitter.on('other', otherHandler);

      emitter.emit('test', 'value');
      emitter.emit('other', 42);

      expect(testHandler).toHaveBeenCalledTimes(1);
      expect(otherHandler).toHaveBeenCalledTimes(1);

      emitter.off('test', testHandler);

      emitter.emit('test', 'value2');
      emitter.emit('other', 43);

      expect(testHandler).toHaveBeenCalledTimes(1);
      expect(otherHandler).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Edge Case Tests', () => {
  describe('Empty and null data', () => {
    it('should handle empty data array', () => {
      const gridState = new GridState<TestItem>({
        columns: mockColumns,
        data: [],
        getRowId: (item) => item.id,
      });

      const { items, totalCount } = gridState.getProcessedItems();
      expect(items).toEqual([]);
      expect(totalCount).toBe(0);

      gridState.destroy();
    });

    it('should handle undefined data (defaults to empty)', () => {
      const gridState = new GridState<TestItem>({
        columns: mockColumns,
        getRowId: (item) => item.id,
      });

      const { items, totalCount } = gridState.getProcessedItems();
      expect(items).toEqual([]);
      expect(totalCount).toBe(0);

      gridState.destroy();
    });

    it('should handle selection with empty data', () => {
      const selectionState = new SelectionState();

      selectionState.setActiveCell({ rowIndex: 0, columnIndex: 0 });

      expect(selectionState.activeCell).toEqual({ rowIndex: 0, columnIndex: 0 });
      expect(selectionState.selectionRange).toBeTruthy();

      selectionState.destroy();
    });

    it('should handle filtering on empty data', () => {
      const gridState = new GridState<TestItem>({
        columns: mockColumns,
        data: [],
        getRowId: (item) => item.id,
      });

      gridState.setFilter('name', { type: 'text', value: 'test' });
      const { items, totalCount } = gridState.getProcessedItems();

      expect(items).toEqual([]);
      expect(totalCount).toBe(0);

      gridState.destroy();
    });
  });

  describe('Rapid state changes', () => {
    it('should handle rapid filter changes', () => {
      const data: TestItem[] = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        value: (i + 1) * 10,
      }));

      const gridState = new GridState({
        columns: mockColumns,
        data,
        getRowId: (item) => item.id,
      });

      for (let i = 0; i < 10; i++) {
        gridState.setFilter('name', { type: 'text', value: `User ${i}` });
      }

      const { items } = gridState.getProcessedItems();
      expect(items.every((item) => item.name.includes('User 9'))).toBe(true);

      gridState.destroy();
    });

    it('should handle rapid selection changes', () => {
      const selectionState = new SelectionState();
      let changeCount = 0;

      selectionState.onSelectionChange(() => {
        changeCount++;
      });

      for (let i = 0; i < 20; i++) {
        selectionState.setActiveCell({ rowIndex: i, columnIndex: i % 3 });
      }

      expect(changeCount).toBe(20);
      expect(selectionState.activeCell).toEqual({ rowIndex: 19, columnIndex: 1 });

      selectionState.destroy();
    });
  });

  describe('Large dataset performance', () => {
    it('should handle 1000 rows without performance issues', () => {
      const largeData: TestItem[] = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        value: (i + 1) * 10,
      }));

      const startTime = performance.now();

      const gridState = new GridState({
        columns: mockColumns,
        data: largeData,
        getRowId: (item) => item.id,
        pageSize: 50,
      });

      const { items, totalCount } = gridState.getProcessedItems();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(totalCount).toBe(1000);
      expect(items).toHaveLength(50);
      expect(duration).toBeLessThan(100);

      gridState.destroy();
    });

    it('should handle sorting 1000 rows', () => {
      const largeData: TestItem[] = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `User ${1000 - i}`,
        value: (i + 1) * 10,
      }));

      const gridState = new GridState({
        columns: mockColumns,
        data: largeData,
        getRowId: (item) => item.id,
        pageSize: 50,
      });

      const startTime = performance.now();

      gridState.setSort({ field: 'name', direction: 'asc' });
      const { items } = gridState.getProcessedItems();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(items[0].name).toBe('User 1');
      expect(duration).toBeLessThan(200);

      gridState.destroy();
    });
  });

  describe('Boundary conditions', () => {
    it('should handle page size of 0', () => {
      const data: TestItem[] = [
        { id: 1, name: 'Alice', value: 100 },
        { id: 2, name: 'Bob', value: 200 },
      ];

      const gridState = new GridState({
        columns: mockColumns,
        data,
        getRowId: (item) => item.id,
        pageSize: 0,
      });

      const { items } = gridState.getProcessedItems();
      expect(items).toEqual([]);

      gridState.destroy();
    });

    it('should handle page number beyond available pages', () => {
      const data: TestItem[] = [
        { id: 1, name: 'Alice', value: 100 },
        { id: 2, name: 'Bob', value: 200 },
      ];

      const gridState = new GridState({
        columns: mockColumns,
        data,
        getRowId: (item) => item.id,
        pageSize: 10,
      });

      gridState.setPage(999);
      const { items } = gridState.getProcessedItems();

      expect(items).toEqual([]);

      gridState.destroy();
    });

    it('should handle HeaderFilterState with no filter options', () => {
      const headerFilterState = new HeaderFilterState(jest.fn());

      const options = headerFilterState.getFilterOptions('nonexistent');
      expect(options).toEqual([]);

      headerFilterState.destroy();
    });
  });
});

describe('State Unit Tests', () => {
  describe('HeaderFilterState', () => {
    it('should handle search text filtering for multiSelect', () => {
      const headerFilterState = new HeaderFilterState(jest.fn());

      headerFilterState.setFilterOptions({
        category: ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'],
      });

      const headerEl = document.createElement('div');
      const popoverEl = document.createElement('div');

      headerFilterState.open('category', {
        columnId: 'category',
        filterField: 'category',
        filterType: 'multiSelect',
      }, headerEl, popoverEl);

      let filtered = headerFilterState.getFilteredOptions('category');
      expect(filtered).toHaveLength(5);

      headerFilterState.setSearchText('err');
      filtered = headerFilterState.getFilteredOptions('category');
      expect(filtered).toHaveLength(2);
      expect(filtered).toContain('Cherry');
      expect(filtered).toContain('Elderberry');

      headerFilterState.destroy();
    });

    it('should handle select all and clear selection', () => {
      const headerFilterState = new HeaderFilterState(jest.fn());

      headerFilterState.setFilterOptions({
        category: ['A', 'B', 'C'],
      });

      const headerEl = document.createElement('div');
      const popoverEl = document.createElement('div');

      headerFilterState.open('category', {
        columnId: 'category',
        filterField: 'category',
        filterType: 'multiSelect',
      }, headerEl, popoverEl);

      headerFilterState.handleSelectAll('category');
      expect(headerFilterState.tempSelected.size).toBe(3);

      headerFilterState.handleClearSelection();
      expect(headerFilterState.tempSelected.size).toBe(0);

      headerFilterState.destroy();
    });

    it('should detect active filters correctly', () => {
      const headerFilterState = new HeaderFilterState(jest.fn());

      headerFilterState.setFilters({
        name: { type: 'text', value: 'Alice' },
        category: { type: 'multiSelect', value: ['A', 'B'] },
        value: { type: 'text', value: '' },
      });

      expect(headerFilterState.hasActiveFilter({
        columnId: 'name',
        filterField: 'name',
        filterType: 'text',
      })).toBe(true);

      expect(headerFilterState.hasActiveFilter({
        columnId: 'category',
        filterField: 'category',
        filterType: 'multiSelect',
      })).toBe(true);

      expect(headerFilterState.hasActiveFilter({
        columnId: 'value',
        filterField: 'value',
        filterType: 'text',
      })).toBe(false);

      headerFilterState.destroy();
    });
  });

  describe('RowSelectionState', () => {
    it('should handle shift-click range selection', () => {
      const rowSelectionState = new RowSelectionState<TestItem>(
        'multiple',
        (item) => item.id
      );

      rowSelectionState.handleRowCheckboxChange(
        mockData[0].id,
        true,
        0,
        false,
        mockData
      );
      expect(rowSelectionState.selectedRowIds.size).toBe(1);

      rowSelectionState.handleRowCheckboxChange(
        mockData[2].id,
        true,
        2,
        true, // shift key
        mockData
      );
      expect(rowSelectionState.selectedRowIds.size).toBe(3);

      rowSelectionState.destroy();
    });

    it('should handle select all', () => {
      const rowSelectionState = new RowSelectionState<TestItem>(
        'multiple',
        (item) => item.id
      );

      rowSelectionState.handleSelectAll(true, mockData);
      expect(rowSelectionState.selectedRowIds.size).toBe(3);
      expect(rowSelectionState.isAllSelected(mockData)).toBe(true);

      rowSelectionState.handleSelectAll(false, mockData);
      expect(rowSelectionState.selectedRowIds.size).toBe(0);

      rowSelectionState.destroy();
    });

    it('should emit events on selection change', () => {
      const rowSelectionState = new RowSelectionState<TestItem>(
        'multiple',
        (item) => item.id
      );

      const handler = jest.fn();
      rowSelectionState.onRowSelectionChange(handler);

      rowSelectionState.handleRowCheckboxChange(
        mockData[0].id,
        true,
        0,
        false,
        mockData
      );
      expect(handler).toHaveBeenCalledTimes(1);

      rowSelectionState.handleSelectAll(true, mockData);
      expect(handler).toHaveBeenCalledTimes(2);

      rowSelectionState.destroy();
    });

    it('should get selected rows', () => {
      const rowSelectionState = new RowSelectionState<TestItem>(
        'multiple',
        (item) => item.id
      );

      rowSelectionState.handleRowCheckboxChange(mockData[0].id, true, 0, false, mockData);
      rowSelectionState.handleRowCheckboxChange(mockData[2].id, true, 2, false, mockData);

      const selected = rowSelectionState.getSelectedRows(mockData);
      expect(selected).toHaveLength(2);
      expect(selected[0]).toBe(mockData[0]);
      expect(selected[1]).toBe(mockData[2]);

      rowSelectionState.destroy();
    });
  });

  describe('SideBarState', () => {
    it('should initialize with config', () => {
      const sideBarState = new SideBarState(true);

      expect(sideBarState.isEnabled).toBe(true);
      expect(sideBarState.position).toBe('right');
      expect(sideBarState.isOpen).toBe(false);

      sideBarState.destroy();
    });

    it('should toggle specific panels', () => {
      const sideBarState = new SideBarState({ panels: ['columns', 'filters'] });

      sideBarState.setActivePanel('columns');
      expect(sideBarState.activePanel).toBe('columns');
      expect(sideBarState.isOpen).toBe(true);

      sideBarState.setActivePanel('filters');
      expect(sideBarState.activePanel).toBe('filters');

      sideBarState.close();
      expect(sideBarState.activePanel).toBeNull();
      expect(sideBarState.isOpen).toBe(false);

      sideBarState.destroy();
    });

    it('should toggle panels', () => {
      const sideBarState = new SideBarState(true);

      sideBarState.toggle('columns');
      expect(sideBarState.activePanel).toBe('columns');

      sideBarState.toggle('columns');
      expect(sideBarState.activePanel).toBeNull();

      sideBarState.destroy();
    });

    it('should emit change events', () => {
      const sideBarState = new SideBarState(true);
      const handler = jest.fn();

      sideBarState.onChange(handler);

      sideBarState.setActivePanel('columns');
      expect(handler).toHaveBeenCalledTimes(1);

      sideBarState.toggle('filters');
      expect(handler).toHaveBeenCalledTimes(2);

      sideBarState.close();
      expect(handler).toHaveBeenCalledTimes(3);

      sideBarState.destroy();
    });

    it('should handle disabled state', () => {
      const sideBarState = new SideBarState(false);

      expect(sideBarState.isEnabled).toBe(false);

      sideBarState.destroy();
    });
  });
});
