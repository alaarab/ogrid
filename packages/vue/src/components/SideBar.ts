/**
 * SideBar types for Vue. The actual SideBar rendering is done by UI packages (.vue SFCs).
 * This file exports the shared SideBarProps interface used by composables.
 */
import type { IColumnDefinition, SideBarPanelId, IFilters, FilterValue } from '../types';

/** Describes a filterable column for the sidebar filters panel. */
export interface SideBarFilterColumn {
  columnId: string;
  name: string;
  filterField: string;
  filterType: 'text' | 'multiSelect' | 'people' | 'date';
}

export interface SideBarProps {
  activePanel: SideBarPanelId | null;
  onPanelChange: (panel: SideBarPanelId | null) => void;
  panels: SideBarPanelId[];
  position: 'left' | 'right';
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, visible: boolean) => void;
  onSetVisibleColumns: (columns: Set<string>) => void;
  filterableColumns: SideBarFilterColumn[];
  filters: IFilters;
  onFilterChange: (key: string, value: FilterValue | undefined) => void;
  filterOptions: Record<string, string[]>;
}
