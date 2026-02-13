/**
 * Shared ColumnChooser tests for Vue.
 * Each Vue UI package calls createColumnChooserTests() to run these.
 * Tests the useColumnChooserState composable directly.
 */
import { ref } from 'vue';
import { useColumnChooserState } from '../composables/useColumnChooserState';
import type { IColumnDefinition } from '../types';

export function createColumnChooserTests(): void {
  const columns: IColumnDefinition[] = [
    { columnId: 'a', name: 'Col A' },
    { columnId: 'b', name: 'Col B' },
  ];

  it('toggles column visibility', () => {
    const onVisibilityChange = jest.fn();
    const state = useColumnChooserState({
      columns: ref(columns),
      visibleColumns: ref(new Set(['a'])),
      onVisibilityChange,
    });

    state.handleCheckboxChange('b')(true);
    expect(onVisibilityChange).toHaveBeenCalledWith('b', true);
  });

  it('select all shows all columns', () => {
    const onVisibilityChange = jest.fn();
    const state = useColumnChooserState({
      columns: ref(columns),
      visibleColumns: ref(new Set(['a'])),
      onVisibilityChange,
    });

    state.handleSelectAll();
    expect(onVisibilityChange).toHaveBeenCalledWith('b', true);
  });

  it('clear all hides non-required columns', () => {
    const onVisibilityChange = jest.fn();
    const columnsWithRequired: IColumnDefinition[] = [
      { columnId: 'id', name: 'ID', required: true },
      ...columns,
    ];
    const state = useColumnChooserState({
      columns: ref(columnsWithRequired),
      visibleColumns: ref(new Set(['id', 'a', 'b'])),
      onVisibilityChange,
    });

    state.handleClearAll();
    expect(onVisibilityChange).toHaveBeenCalledWith('a', false);
    expect(onVisibilityChange).toHaveBeenCalledWith('b', false);
    expect(onVisibilityChange).not.toHaveBeenCalledWith('id', false);
  });

  it('tracks open state and toggles', () => {
    const state = useColumnChooserState({
      columns: ref(columns),
      visibleColumns: ref(new Set(['a', 'b'])),
      onVisibilityChange: jest.fn(),
    });

    expect(state.open.value).toBe(false);
    state.handleToggle();
    expect(state.open.value).toBe(true);
    state.handleClose();
    expect(state.open.value).toBe(false);
  });
}
