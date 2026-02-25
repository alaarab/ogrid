import { Component, inject, ChangeDetectionStrategy, Input, signal, effect, computed } from '@angular/core';
import {
  OGridService,
  OGridLayoutComponent,
} from '@alaarab/ogrid-angular';
import type { IOGridProps, RowId } from '@alaarab/ogrid-angular';
import { DataGridTableComponent } from '../datagrid-table/datagrid-table.component';
import { ColumnChooserComponent } from '../column-chooser/column-chooser.component';
import { PaginationControlsComponent } from '../pagination-controls/pagination-controls.component';

@Component({
  selector: 'ogrid-primeng',
  standalone: true,
  imports: [
    OGridLayoutComponent,
    DataGridTableComponent,
    ColumnChooserComponent,
    PaginationControlsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [OGridService],
  styles: [`:host { display: block; height: 100%; }`],
  template: `
    <ogrid-layout
      [className]="service.className()"
      [hasToolbar]="showToolbar"
      [hasToolbarBelow]="false"
      [hasPagination]="true"
      [sideBar]="service.sideBarProps()"
      [fullScreen]="service.fullScreen()"
      [showNameBox]="!!(service.cellReferences() && !service.formulasEnabled())"
      [activeCellRef]="service.activeCellRef()"
      [formulaBar]="service.formulasEnabled() ? service.formulaBarState() : null"
    >
      <ng-content select="[toolbar]" toolbar></ng-content>

      <div toolbarEnd>
        @if (service.columnChooserPlacement() === 'toolbar') {
          <ogrid-primeng-column-chooser
            [columns]="service.columnChooser().columns"
            [visibleColumns]="service.columnChooser().visibleColumns"
            (visibilityChange)="service.handleVisibilityChange($event.columnKey, $event.visible)"
          ></ogrid-primeng-column-chooser>
        }
      </div>

      <ogrid-primeng-datagrid-table
        [items]="service.displayItems()"
        [columns]="service.columnsProp()"
        [getRowId]="service.getRowId()"
        [sortBy]="service.sort().field"
        [sortDirection]="service.sort().direction"
        [onColumnSort]="onColumnSortFn"
        [visibleColumns]="service.visibleColumns()"
        [columnOrder]="service.columnOrder()"
        [onColumnOrderChange]="service.onColumnOrderChange()"
        [onColumnResized]="onColumnResizedFn"
        [onColumnPinned]="onColumnPinnedFn"
        [editable]="service.editable()"
        [cellSelection]="service.cellSelection()"
        [onCellValueChanged]="service.onCellValueChanged()"
        [onUndo]="service.onUndo()"
        [onRedo]="service.onRedo()"
        [canUndo]="service.canUndo()"
        [canRedo]="service.canRedo()"
        [rowSelection]="service.rowSelection()"
        [selectedRows]="service.effectiveSelectedRows()"
        [onSelectionChange]="onSelectionChangeFn"
        [statusBar]="service.statusBarConfig()"
        [isLoading]="service.isLoadingResolved()"
        [filters]="service.filters()"
        [onFilterChange]="onFilterChangeFn"
        [filterOptions]="service.clientFilterOptions()"
        [loadingFilterOptions]="service.loadingFilterOptions()"
        [peopleSearch]="service.dataSource()?.searchPeople?.bind(service.dataSource())"
        [getUserByEmail]="service.dataSource()?.getUserByEmail?.bind(service.dataSource())"
        [layoutMode]="service.layoutMode()"
        [suppressHorizontalScroll]="service.suppressHorizontalScroll()"
        [stickyHeaderInput]="service.stickyHeader()"
        [columnReorder]="service.columnReorder()"
        [aria-label]="service.ariaLabel()"
        [aria-labelledby]="service.ariaLabelledBy()"
        [emptyState]="emptyStateObj"
        [showRowNumbers]="service.dataGridProps().showRowNumbers ?? false"
        [showColumnLetters]="service.dataGridProps().showColumnLetters ?? false"
        [showNameBox]="service.dataGridProps().showNameBox ?? false"
        [onActiveCellChange]="service.dataGridProps().onActiveCellChange"
      ></ogrid-primeng-datagrid-table>

      <div pagination>
        <ogrid-primeng-pagination-controls
          [currentPage]="service.pagination().page"
          [pageSize]="service.pagination().pageSize"
          [totalCount]="service.pagination().displayTotalCount"
          [pageSizeOptions]="service.pageSizeOptions()"
          [entityLabelPlural]="service.entityLabelPlural()"
          (pageChange)="service.setPage($event)"
          (pageSizeChange)="onPageSizeChange($event)"
        ></ogrid-primeng-pagination-controls>
      </div>
    </ogrid-layout>
  `,
})
export class OGridComponent<T = unknown> {
  readonly service = inject<OGridService<T>>(OGridService);
  private readonly propsSignal = signal<IOGridProps<T> | undefined>(undefined);

  @Input({ required: true })
  set props(value: IOGridProps<T>) {
    this.propsSignal.set(value);
  }

  // Stable callback references (avoid re-creating every template eval)
  readonly onColumnSortFn = (columnKey: string, direction?: 'asc' | 'desc' | null) => this.service.handleSort(columnKey, direction);
  readonly onColumnResizedFn = (columnId: string, width: number) => this.service.handleColumnResized(columnId, width);
  readonly onColumnPinnedFn = (columnId: string, pinned: 'left' | 'right' | null) => this.service.handleColumnPinned(columnId, pinned);
  readonly onSelectionChangeFn = (event: { selectedRowIds: RowId[]; selectedItems: T[] }) => this.service.handleSelectionChange(event);
  readonly onFilterChangeFn = (key: string, value: unknown) => this.service.handleFilterChange(key, value as never);

  constructor() {
    effect(() => {
      const p = this.propsSignal();
      if (p) this.service.configure(p);
    });
  }

  get showToolbar(): boolean {
    return this.service.columnChooserPlacement() === 'toolbar' || this.service.toolbar() != null || this.service.fullScreen();
  }

  private readonly clearAllFiltersFn = () => this.service.setFilters({});
  readonly emptyStateComputed = computed(() => ({
    hasActiveFilters: this.service.hasActiveFilters(),
    onClearAll: this.clearAllFiltersFn,
    message: this.service.emptyState()?.message,
    render: this.service.emptyState()?.render,
  }));

  get emptyStateObj() {
    return this.emptyStateComputed();
  }

  onPageSizeChange(size: number): void {
    this.service.setPageSize(size);
  }
}
