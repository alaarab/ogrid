import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { IColumnDefinition, SideBarPanelId, IFilters, FilterValue } from '../types';
// GRID_BORDER_RADIUS used by ogrid-layout, not sidebar

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

const PANEL_WIDTH = 240;
const TAB_WIDTH = 36;
const PANEL_LABELS: Record<SideBarPanelId, string> = { columns: 'Columns', filters: 'Filters' };

@Component({
  selector: 'ogrid-sidebar',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .ogrid-sidebar-root { display: flex; flex-direction: row; flex-shrink: 0; }
    .ogrid-sidebar-tab-strip {
      display: flex; flex-direction: column;
      width: var(--ogrid-sidebar-tab-size, 36px);
      background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-sidebar-tab-strip--left { border-right: 1px solid var(--ogrid-border, #e0e0e0); }
    .ogrid-sidebar-tab-strip--right { border-left: 1px solid var(--ogrid-border, #e0e0e0); }
    .ogrid-sidebar-tab {
      width: var(--ogrid-sidebar-tab-size, 36px);
      height: var(--ogrid-sidebar-tab-size, 36px);
      border: none; cursor: pointer;
      color: var(--ogrid-fg, #242424); font-size: 14px;
      display: flex; align-items: center; justify-content: center;
      background: transparent; font-weight: normal;
    }
    .ogrid-sidebar-tab--active { background: var(--ogrid-bg, #fff); font-weight: bold; }
    .ogrid-sidebar-panel {
      width: var(--ogrid-sidebar-panel-width, 240px);
      display: flex; flex-direction: column; overflow: hidden;
      background: var(--ogrid-bg, #fff); color: var(--ogrid-fg, #242424);
    }
    .ogrid-sidebar-panel--left { border-right: 1px solid var(--ogrid-border, #e0e0e0); }
    .ogrid-sidebar-panel--right { border-left: 1px solid var(--ogrid-border, #e0e0e0); }
    .ogrid-sidebar-panel-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 12px; border-bottom: 1px solid var(--ogrid-border, #e0e0e0); font-weight: 600;
    }
    .ogrid-sidebar-panel-close {
      border: none; background: transparent; cursor: pointer;
      font-size: 16px; color: var(--ogrid-fg, #242424);
    }
    .ogrid-sidebar-panel-body { flex: 1; overflow-y: auto; padding: 8px 12px; }
    .ogrid-sidebar-actions { display: flex; gap: 8px; margin-bottom: 8px; }
    .ogrid-sidebar-action-btn {
      flex: 1; cursor: pointer;
      background: var(--ogrid-bg-subtle, #f3f2f1); color: var(--ogrid-fg, #242424);
      border: 1px solid var(--ogrid-border, #e0e0e0); border-radius: 4px; padding: 4px 8px;
    }
    .ogrid-sidebar-col-label { display: flex; align-items: center; gap: 6px; padding: 2px 0; cursor: pointer; }
    .ogrid-sidebar-empty { color: var(--ogrid-muted, #999); font-style: italic; }
    .ogrid-sidebar-filter-group { margin-bottom: 12px; }
    .ogrid-sidebar-filter-label { font-weight: 500; margin-bottom: 4px; font-size: 13px; }
    .ogrid-sidebar-text-input {
      width: 100%; box-sizing: border-box; padding: 4px 6px;
      background: var(--ogrid-bg, #fff); color: var(--ogrid-fg, #242424);
      border: 1px solid var(--ogrid-border, #e0e0e0); border-radius: 4px;
    }
    .ogrid-sidebar-date-row { display: flex; flex-direction: column; gap: 4px; }
    .ogrid-sidebar-date-label { display: flex; align-items: center; gap: 4px; font-size: 12px; }
    .ogrid-sidebar-date-input {
      flex: 1; padding: 2px 4px;
      background: var(--ogrid-bg, #fff); color: var(--ogrid-fg, #242424);
      border: 1px solid var(--ogrid-border, #e0e0e0); border-radius: 4px;
    }
    .ogrid-sidebar-multiselect-list { max-height: 120px; overflow-y: auto; }
    .ogrid-sidebar-multiselect-item {
      display: flex; align-items: center; gap: 4px;
      padding: 1px 0; cursor: pointer; font-size: 13px;
    }
  `],
  template: `
    <div class="ogrid-sidebar-root" role="complementary" aria-label="Side bar">
      @if (sideBarProps?.position === 'left') {
        <ng-container *ngTemplateOutlet="tabStripTpl"></ng-container>
        <ng-container *ngTemplateOutlet="panelContentTpl"></ng-container>
      }
      @if (sideBarProps?.position === 'right') {
        <ng-container *ngTemplateOutlet="panelContentTpl"></ng-container>
        <ng-container *ngTemplateOutlet="tabStripTpl"></ng-container>
      }
    </div>

    <ng-template #tabStripTpl>
      <div
        class="ogrid-sidebar-tab-strip"
        [class.ogrid-sidebar-tab-strip--left]="sideBarProps?.position === 'left'"
        [class.ogrid-sidebar-tab-strip--right]="sideBarProps?.position === 'right'"
        role="tablist"
        aria-label="Side bar tabs"
      >
        @for (panel of sideBarProps?.panels ?? []; track panel) {
          <button
            role="tab"
            class="ogrid-sidebar-tab"
            [class.ogrid-sidebar-tab--active]="sideBarProps?.activePanel === panel"
            [attr.aria-selected]="sideBarProps?.activePanel === panel"
            [attr.aria-label]="panelLabels[panel]"
            (click)="onTabClick(panel)"
            [title]="panelLabels[panel]"
          >
            {{ panel === 'columns' ? '\u2261' : '\u2A65' }}
          </button>
        }
      </div>
    </ng-template>

    <ng-template #panelContentTpl>
      @if (sideBarProps?.activePanel) {
        <div
          role="tabpanel"
          class="ogrid-sidebar-panel"
          [class.ogrid-sidebar-panel--left]="sideBarProps?.position === 'left'"
          [class.ogrid-sidebar-panel--right]="sideBarProps?.position === 'right'"
          [attr.aria-label]="panelLabels[sideBarProps!.activePanel!]"
        >
          <div class="ogrid-sidebar-panel-header">
            <span>{{ panelLabels[sideBarProps!.activePanel!] }}</span>
            <button (click)="sideBarProps?.onPanelChange(null)" class="ogrid-sidebar-panel-close" aria-label="Close panel">&times;</button>
          </div>
          <div class="ogrid-sidebar-panel-body">
            @if (sideBarProps?.activePanel === 'columns') {
              <div class="ogrid-sidebar-actions">
                <button (click)="onSelectAll()" [disabled]="allVisible()" class="ogrid-sidebar-action-btn">Select All</button>
                <button (click)="onClearAll()" class="ogrid-sidebar-action-btn">Clear All</button>
              </div>
              @for (col of sideBarProps?.columns ?? []; track col.columnId) {
                <label class="ogrid-sidebar-col-label">
                  <input type="checkbox" [checked]="sideBarProps?.visibleColumns?.has(col.columnId)" (change)="onVisibilityChange(col.columnId, $any($event.target).checked)" [disabled]="col.required" />
                  <span>{{ col.name }}</span>
                </label>
              }
            }
            @if (sideBarProps?.activePanel === 'filters') {
              @if ((sideBarProps?.filterableColumns ?? []).length === 0) {
                <div class="ogrid-sidebar-empty">No filterable columns</div>
              }
              @for (col of sideBarProps?.filterableColumns ?? []; track col.columnId) {
                <div class="ogrid-sidebar-filter-group">
                  <div class="ogrid-sidebar-filter-label">{{ col.name }}</div>
                  @if (col.filterType === 'text') {
                    <input
                      type="text"
                      class="ogrid-sidebar-text-input"
                      [value]="getTextFilterValue(col.filterField)"
                      (input)="onTextFilterChange(col.filterField, $any($event.target).value)"
                      [placeholder]="'Filter ' + col.name + '...'"
                      [attr.aria-label]="'Filter ' + col.name"
                    />
                  }
                  @if (col.filterType === 'date') {
                    <div class="ogrid-sidebar-date-row">
                      <label class="ogrid-sidebar-date-label">
                        From:
                        <input type="date" class="ogrid-sidebar-date-input" [value]="getDateFrom(col.filterField)" (change)="onDateFromChange(col.filterField, $any($event.target).value)" [attr.aria-label]="col.name + ' from date'" />
                      </label>
                      <label class="ogrid-sidebar-date-label">
                        To:
                        <input type="date" class="ogrid-sidebar-date-input" [value]="getDateTo(col.filterField)" (change)="onDateToChange(col.filterField, $any($event.target).value)" [attr.aria-label]="col.name + ' to date'" />
                      </label>
                    </div>
                  }
                  @if (col.filterType === 'multiSelect') {
                    <div class="ogrid-sidebar-multiselect-list" role="group" [attr.aria-label]="col.name + ' options'">
                      @for (opt of getFilterOptions(col.filterField); track opt) {
                        <label class="ogrid-sidebar-multiselect-item">
                          <input type="checkbox" [checked]="isMultiSelectChecked(col.filterField, opt)" (change)="onMultiSelectChange(col.filterField, opt, $any($event.target).checked)" />
                          <span>{{ opt }}</span>
                        </label>
                      }
                    </div>
                  }
                </div>
              }
            }
          </div>
        </div>
      }
    </ng-template>
  `,
})
export class SideBarComponent {
  @Input() sideBarProps: SideBarProps | null = null;

  readonly panelLabels = PANEL_LABELS;
  readonly tabWidth = TAB_WIDTH;
  readonly panelWidth = PANEL_WIDTH;

  onTabClick(panel: SideBarPanelId): void {
    const props = this.sideBarProps;
    if (props) props.onPanelChange(props.activePanel === panel ? null : panel);
  }

  allVisible(): boolean {
    const props = this.sideBarProps;
    if (!props) return false;
    return props.columns.every((c) => props.visibleColumns.has(c.columnId));
  }

  onSelectAll(): void {
    const props = this.sideBarProps;
    if (!props) return;
    const next = new Set(props.visibleColumns);
    props.columns.forEach((c) => next.add(c.columnId));
    props.onSetVisibleColumns(next);
  }

  onClearAll(): void {
    const props = this.sideBarProps;
    if (!props) return;
    const next = new Set<string>();
    props.columns.forEach((c) => {
      if (c.required && props.visibleColumns.has(c.columnId)) next.add(c.columnId);
    });
    props.onSetVisibleColumns(next);
  }

  onVisibilityChange(columnKey: string, visible: boolean): void {
    this.sideBarProps?.onVisibilityChange(columnKey, visible);
  }

  getTextFilterValue(filterField: string): string {
    const filters = this.sideBarProps?.filters;
    const fv = filters?.[filterField];
    return fv?.type === 'text' ? fv.value : '';
  }

  onTextFilterChange(filterField: string, value: string): void {
    this.sideBarProps?.onFilterChange(filterField, value ? { type: 'text', value } : undefined);
  }

  getDateFrom(filterField: string): string {
    const fv = this.sideBarProps?.filters?.[filterField];
    return fv?.type === 'date' ? (fv.value.from ?? '') : '';
  }

  getDateTo(filterField: string): string {
    const fv = this.sideBarProps?.filters?.[filterField];
    return fv?.type === 'date' ? (fv.value.to ?? '') : '';
  }

  onDateFromChange(filterField: string, value: string): void {
    const fv = this.sideBarProps?.filters?.[filterField];
    const existing = fv?.type === 'date' ? fv.value : {};
    const from = value || undefined;
    const to = existing.to;
    this.sideBarProps?.onFilterChange(filterField, from || to ? { type: 'date', value: { from, to } } : undefined);
  }

  onDateToChange(filterField: string, value: string): void {
    const fv = this.sideBarProps?.filters?.[filterField];
    const existing = fv?.type === 'date' ? fv.value : {};
    const to = value || undefined;
    const from = existing.from;
    this.sideBarProps?.onFilterChange(filterField, from || to ? { type: 'date', value: { from, to } } : undefined);
  }

  getFilterOptions(filterField: string): string[] {
    return this.sideBarProps?.filterOptions?.[filterField] ?? [];
  }

  isMultiSelectChecked(filterField: string, opt: string): boolean {
    const fv = this.sideBarProps?.filters?.[filterField];
    return fv?.type === 'multiSelect' ? fv.value.includes(opt) : false;
  }

  onMultiSelectChange(filterField: string, opt: string, checked: boolean): void {
    const fv = this.sideBarProps?.filters?.[filterField];
    const current = fv?.type === 'multiSelect' ? fv.value : [];
    const next = checked ? [...current, opt] : current.filter((v) => v !== opt);
    this.sideBarProps?.onFilterChange(filterField, next.length > 0 ? { type: 'multiSelect', value: next } : undefined);
  }
}
