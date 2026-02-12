import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import {
  OGridService,
  OGridLayoutComponent,
} from '@alaarab/ogrid-angular';
import type { IOGridProps, IOGridDataGridProps } from '@alaarab/ogrid-angular';
import { DataGridTableComponent } from '../datagrid-table/datagrid-table.component';
import { ColumnChooserComponent } from '../column-chooser/column-chooser.component';
import { PaginationControlsComponent } from '../pagination-controls/pagination-controls.component';

/**
 * Top-level OGrid component for Angular Radix (lightweight Angular CDK-based implementation).
 * This is the recommended default option for Angular developers.
 * Standalone component — provides OGridService and renders OGridLayout with all sub-components.
 */
@Component({
  selector: 'ogrid',
  standalone: true,
  imports: [
    OGridLayoutComponent,
    DataGridTableComponent,
    ColumnChooserComponent,
    PaginationControlsComponent,
  ],
  providers: [OGridService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ogrid-layout
      [className]="ogridService.className()"
      [sideBar]="ogridService.sideBarProps()"
      [toolbar]="ogridService.toolbar()"
      [toolbarBelow]="ogridService.toolbarBelow()"
    >
      <ng-container toolbar-end>
        @if (ogridService.columnChooserPlacement() === 'toolbar') {
          <ogrid-column-chooser
            [columns]="ogridService.columnChooser().columns"
            [visibleColumns]="ogridService.columnChooser().visibleColumns"
            (visibilityChange)="ogridService.columnChooser().onVisibilityChange($event.columnKey, $event.visible)"
          />
        }
      </ng-container>

      <ogrid-datagrid-table [props]="dataGridProps()" />

      <ng-container pagination>
        <ogrid-pagination-controls
          [currentPage]="ogridService.pagination().page"
          [pageSize]="ogridService.pagination().pageSize"
          [totalCount]="ogridService.pagination().displayTotalCount"
          [pageSizeOptions]="ogridService.pagination().pageSizeOptions"
          [entityLabelPlural]="ogridService.pagination().entityLabelPlural"
          (pageChange)="ogridService.pagination().setPage($event)"
          (pageSizeChange)="onPageSizeChange($event)"
        />
      </ng-container>
    </ogrid-layout>
  `,
})
export class OGridComponent<T> {
  readonly props = input.required<IOGridProps<T>>();

  readonly ogridService: OGridService<T>;

  readonly dataGridProps = computed<IOGridDataGridProps<T>>(() => {
    this.ogridService.configure(this.props());
    return this.ogridService.dataGridProps();
  });

  constructor() {
    this.ogridService = new OGridService<T>();
  }

  onPageSizeChange(size: number): void {
    this.ogridService.pagination().setPageSize(size);
    this.ogridService.pagination().setPage(1);
  }
}
