import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  OGridService,
  OGridLayoutComponent,
  BaseOGridComponent,
} from '@alaarab/ogrid-angular';
import { DataGridTableComponent } from '../datagrid-table/datagrid-table.component';
import { ColumnChooserComponent } from '../column-chooser/column-chooser.component';
import { PaginationControlsComponent } from '../pagination-controls/pagination-controls.component';

/**
 * Top-level OGrid component for Angular Material.
 * Standalone component — provides OGridService and renders OGridLayout with all sub-components.
 *
 * Uses @Input with signal setter for JIT compatibility (project builds with tsc, not ngc).
 * The effect() reactively configures the service when the input signal changes.
 */
@Component({
  selector: 'ogrid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    OGridLayoutComponent,
    DataGridTableComponent,
    ColumnChooserComponent,
    PaginationControlsComponent,
  ],
  providers: [OGridService],
  styles: [`:host { display: block; height: 100%; }`],
  template: `
    <ogrid-layout
      [className]="ogridService.className()"
      [sideBar]="ogridService.sideBarProps()"
      [hasToolbar]="showToolbar"
      [hasToolbarBelow]="false"
      [hasPagination]="true"
      [fullScreen]="ogridService.fullScreen()"
    >
      <ng-container toolbarEnd>
        @if (ogridService.columnChooserPlacement() === 'toolbar') {
          <ogrid-column-chooser
            [columns]="ogridService.columnChooser().columns"
            [visibleColumns]="ogridService.columnChooser().visibleColumns"
            (visibilityChange)="ogridService.columnChooser().onVisibilityChange($event.columnKey, $event.visible)"
          />
        }
      </ng-container>

      <ogrid-datagrid-table [props]="ogridService.dataGridProps()" />

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
export class OGridComponent<T> extends BaseOGridComponent<T> {}
