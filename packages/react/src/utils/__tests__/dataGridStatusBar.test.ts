import { getDataGridStatusBarConfig } from '../dataGridStatusBar';
import type { IStatusBarProps } from '../../types';

describe('getDataGridStatusBarConfig', () => {
  it('returns null when statusBar is false', () => {
    const result = getDataGridStatusBarConfig(false, 100, 0);
    expect(result).toBeNull();
  });

  it('returns null when statusBar is undefined', () => {
    const result = getDataGridStatusBarConfig(undefined, 100, 0);
    expect(result).toBeNull();
  });

  it('returns provided object when statusBar is an object', () => {
    const customStatusBar: IStatusBarProps = {
      totalCount: 500,
      selectedCount: 10,
      filteredCount: 50,
    };
    const result = getDataGridStatusBarConfig(customStatusBar, 100, 0);
    expect(result).toEqual(customStatusBar);
  });

  it('returns default config when statusBar is true', () => {
    const result = getDataGridStatusBarConfig(true, 100, 0);
    expect(result).toEqual({
      totalCount: 100,
      selectedCount: undefined,
      filteredCount: undefined,
    });
  });

  it('includes selectedCount when selectedCount > 0', () => {
    const result = getDataGridStatusBarConfig(true, 100, 5);
    expect(result).toEqual({
      totalCount: 100,
      selectedCount: 5,
      filteredCount: undefined,
    });
  });

  it('excludes selectedCount when selectedCount is 0', () => {
    const result = getDataGridStatusBarConfig(true, 100, 0);
    expect(result).toEqual({
      totalCount: 100,
      selectedCount: undefined,
      filteredCount: undefined,
    });
  });

  it('includes filteredCount when different from itemsLength', () => {
    const result = getDataGridStatusBarConfig(true, 100, 0, 75);
    expect(result).toEqual({
      totalCount: 100,
      selectedCount: undefined,
      filteredCount: 75,
    });
  });

  it('excludes filteredCount when same as itemsLength', () => {
    const result = getDataGridStatusBarConfig(true, 100, 0, 100);
    expect(result).toEqual({
      totalCount: 100,
      selectedCount: undefined,
      filteredCount: undefined,
    });
  });

  it('excludes filteredCount when undefined', () => {
    const result = getDataGridStatusBarConfig(true, 100, 0, undefined);
    expect(result).toEqual({
      totalCount: 100,
      selectedCount: undefined,
      filteredCount: undefined,
    });
  });

  it('includes both selectedCount and filteredCount when applicable', () => {
    const result = getDataGridStatusBarConfig(true, 100, 5, 75);
    expect(result).toEqual({
      totalCount: 100,
      selectedCount: 5,
      filteredCount: 75,
    });
  });

  it('handles itemsLength of 0', () => {
    const result = getDataGridStatusBarConfig(true, 0, 0);
    expect(result).toEqual({
      totalCount: 0,
      selectedCount: undefined,
      filteredCount: undefined,
    });
  });

  it('handles large numbers', () => {
    const result = getDataGridStatusBarConfig(true, 1000000, 50000, 750000);
    expect(result).toEqual({
      totalCount: 1000000,
      selectedCount: 50000,
      filteredCount: 750000,
    });
  });

  it('custom object bypasses all auto-derivation logic', () => {
    const customStatusBar: IStatusBarProps = {
      totalCount: 999,
      selectedCount: 0,
      filteredCount: 999,
    };
    const result = getDataGridStatusBarConfig(customStatusBar, 100, 5, 50);
    expect(result).toEqual(customStatusBar);
  });

  it('custom object can omit selectedCount', () => {
    const customStatusBar: IStatusBarProps = {
      totalCount: 200,
    };
    const result = getDataGridStatusBarConfig(customStatusBar, 100, 10);
    expect(result).toEqual(customStatusBar);
  });

  it('custom object can omit filteredCount', () => {
    const customStatusBar: IStatusBarProps = {
      totalCount: 200,
      selectedCount: 10,
    };
    const result = getDataGridStatusBarConfig(customStatusBar, 100, 10, 50);
    expect(result).toEqual(customStatusBar);
  });

  it('handles filteredCount = 0 as different from itemsLength', () => {
    const result = getDataGridStatusBarConfig(true, 100, 0, 0);
    expect(result).toEqual({
      totalCount: 100,
      selectedCount: undefined,
      filteredCount: 0,
    });
  });
});
