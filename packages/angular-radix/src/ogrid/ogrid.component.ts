import { Component, ChangeDetectionStrategy, Input, signal, effect } from '@angular/core';
import {
  OGridService,
  OGridLayoutComponent,
} from '@alaarab/ogrid-angular';
import type { IOGridProps } from '@alaarab/ogrid-angular';
import { DataGridTableComponent } from '../datagrid-table/datagrid-table.component';
import { ColumnChooserComponent } from '../column-chooser/column-chooser.component';
import { PaginationControlsComponent } from '../pagination-controls/pagination-controls.component';

/**
 * Top-level OGrid component for Angular Radix (lightweight Angular CDK-based implementation).
 * This is the recommended default option for Angular developers.
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
  template: `
    <ogrid-layout
      [className]="ogridService.className()"
      [sideBar]="ogridService.sideBarProps()"
      [hasToolbar]="showToolbar"
      [hasToolbarBelow]="false"
      [hasPagination]="true"
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
export class OGridComponent<T> {
  private readonly propsSignal = signal<IOGridProps<T> | undefined>(undefined);
  readonly ogridService: OGridService<T>;

  @Input({ required: true })
  set props(value: IOGridProps<T>) {
    this.propsSignal.set(value);
  }

  constructor() {
    this.ogridService = new OGridService<T>();
    effect(() => {
      const p = this.propsSignal();
      if (p) this.ogridService.configure(p);
    });
  }

  get showToolbar(): boolean {
    return this.ogridService.columnChooserPlacement() === 'toolbar' || this.ogridService.toolbar() != null;
  }

  onPageSizeChange(size: number): void {
    this.ogridService.pagination().setPageSize(size);
    this.ogridService.pagination().setPage(1);
  }
}
