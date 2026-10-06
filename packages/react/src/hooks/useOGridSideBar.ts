import { useMemo } from 'react';
import { useSideBarState } from './useSideBarState';
import { toColumnChooserColumns, toFilterableColumns } from './ogridDerivations';
import type { SideBarProps } from '../components/SideBar';
import type { IColumnDef } from '@alaarab/ogrid-core';
import type { IColumnDefinition, IFilters, IOGridProps } from '../types';

export interface UseOGridSideBarParams<T> {
  sideBar: IOGridProps<T>['sideBar'];
  columns: IColumnDef<T>[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, isVisible: boolean) => void;
  onSetVisibleColumns: (columns: Set<string>) => void;
  filters: IFilters;
  onFilterChange: SideBarProps['onFilterChange'];
  filterOptions: SideBarProps['filterOptions'];
}

export interface UseOGridSideBarState {
  /** `null` when the side bar is off. */
  sideBarProps: SideBarProps | null;
  /** Column chooser entries, shared with the toolbar column chooser. */
  columnChooserColumns: IColumnDefinition[];
}

/** Side bar view model: panels, column chooser entries and filter panel entries. */
export function useOGridSideBar<T>(params: UseOGridSideBarParams<T>): UseOGridSideBarState {
  const { sideBar, columns, visibleColumns, onVisibilityChange, onSetVisibleColumns, filters, onFilterChange, filterOptions } = params;
  const sideBarState = useSideBarState({ config: sideBar });
  const columnChooserColumns = useMemo(() => toColumnChooserColumns(columns), [columns]);
  const filterableColumns = useMemo(() => toFilterableColumns(columns), [columns]);

  const sideBarProps: SideBarProps | null = useMemo(() => {
    if (!sideBarState.isEnabled) return null;
    return {
      activePanel: sideBarState.activePanel,
      onPanelChange: sideBarState.setActivePanel,
      panels: sideBarState.panels,
      position: sideBarState.position,
      columns: columnChooserColumns,
      visibleColumns,
      onVisibilityChange,
      onSetVisibleColumns,
      filterableColumns,
      filters,
      onFilterChange,
      filterOptions,
    };
  }, [
    sideBarState.isEnabled, sideBarState.activePanel, sideBarState.setActivePanel,
    sideBarState.panels, sideBarState.position,
    columnChooserColumns, visibleColumns, onVisibilityChange, onSetVisibleColumns,
    filterableColumns, filters, onFilterChange, filterOptions,
  ]);

  return { sideBarProps, columnChooserColumns };
}
