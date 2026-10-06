import { useMemo } from 'react';
import { useSideBarState } from './useSideBarState';
import { toColumnChooserColumns, toFilterableColumns } from './ogridDerivations';
import type { IColumnDef } from '@alaarab/ogrid-core';
import type { SideBarProps } from '../components/SideBar';
import type { IColumnDefinition, IOGridProps } from '../types';
import type { UseOGridColumnVisibilityState } from './useOGridColumnVisibility';
import type { UseOGridFiltersState } from './useOGridFilters';

export interface UseOGridSideBarState {
  /** `null` when the side bar is off. */
  sideBarProps: SideBarProps | null;
  /** Column chooser entries, shared with the toolbar column chooser. */
  columnChooserColumns: IColumnDefinition[];
}

/** Side bar view model: panels, column chooser entries and filter panel entries. */
export function useOGridSideBar<T>(
  sideBar: IOGridProps<T>['sideBar'],
  columns: IColumnDef<T>[],
  visibility: Pick<UseOGridColumnVisibilityState, 'visibleColumns' | 'handleVisibilityChange' | 'setVisibleColumns'>,
  filtersState: Pick<UseOGridFiltersState, 'filters' | 'handleFilterChange' | 'clientFilterOptions'>,
): UseOGridSideBarState {
  const sideBarState = useSideBarState({ config: sideBar });
  const columnChooserColumns = useMemo(() => toColumnChooserColumns(columns), [columns]);
  const filterableColumns = useMemo(() => toFilterableColumns(columns), [columns]);
  const { visibleColumns, handleVisibilityChange, setVisibleColumns } = visibility;

  const sideBarProps: SideBarProps | null = useMemo(() => {
    if (!sideBarState.isEnabled) return null;
    return {
      activePanel: sideBarState.activePanel,
      onPanelChange: sideBarState.setActivePanel,
      panels: sideBarState.panels,
      position: sideBarState.position,
      columns: columnChooserColumns,
      visibleColumns,
      onVisibilityChange: handleVisibilityChange,
      onSetVisibleColumns: setVisibleColumns,
      filterableColumns,
      filters: filtersState.filters,
      onFilterChange: filtersState.handleFilterChange,
      filterOptions: filtersState.clientFilterOptions,
    };
  }, [
    sideBarState.isEnabled, sideBarState.activePanel, sideBarState.setActivePanel,
    sideBarState.panels, sideBarState.position,
    columnChooserColumns, visibleColumns, handleVisibilityChange, setVisibleColumns,
    filterableColumns, filtersState.filters, filtersState.handleFilterChange, filtersState.clientFilterOptions,
  ]);

  return { sideBarProps, columnChooserColumns };
}
