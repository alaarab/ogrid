import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePaginationControlsComponent } from '@alaarab/ogrid-angular';

/**
 * Pagination controls component using Angular Material styling.
 * Standalone component with inline template — no Angular Material dependency for pagination.
 */
@Component({
  selector: 'ogrid-pagination-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as vm) {
      <nav class="ogrid-pagination" role="navigation" aria-label="Pagination">
        <span class="ogrid-pagination__info">
          Showing {{ vm.startItem }} to {{ vm.endItem }} of {{ totalCount.toLocaleString() }} {{ entityLabelPlural }}
        </span>

        <span class="ogrid-pagination__pages">
          <button
            class="ogrid-pagination__btn"
            [disabled]="currentPage === 1"
            (click)="pageChange.emit(1)"
            aria-label="First page"
          >&laquo;</button>
          <button
            class="ogrid-pagination__btn"
            [disabled]="currentPage === 1"
            (click)="pageChange.emit(currentPage - 1)"
            aria-label="Previous page"
          >&lsaquo;</button>

          @if (vm.showStartEllipsis) {
            <button class="ogrid-pagination__btn" (click)="pageChange.emit(1)" aria-label="Page 1">1</button>
            <span class="ogrid-pagination__ellipsis" aria-hidden="true">&hellip;</span>
          }

          @for (pageNum of vm.pageNumbers; track pageNum) {
            <button
              class="ogrid-pagination__btn"
              [class.ogrid-pagination__btn--active]="currentPage === pageNum"
              (click)="pageChange.emit(pageNum)"
              [attr.aria-label]="'Page ' + pageNum"
              [attr.aria-current]="currentPage === pageNum ? 'page' : null"
            >{{ pageNum }}</button>
          }

          @if (vm.showEndEllipsis) {
            <span class="ogrid-pagination__ellipsis" aria-hidden="true">&hellip;</span>
            <button
              class="ogrid-pagination__btn"
              (click)="pageChange.emit(vm.totalPages)"
              [attr.aria-label]="'Page ' + vm.totalPages"
            >{{ vm.totalPages }}</button>
          }

          <button
            class="ogrid-pagination__btn"
            [disabled]="currentPage >= vm.totalPages"
            (click)="pageChange.emit(currentPage + 1)"
            aria-label="Next page"
          >&rsaquo;</button>
          <button
            class="ogrid-pagination__btn"
            [disabled]="currentPage >= vm.totalPages"
            (click)="pageChange.emit(vm.totalPages)"
            aria-label="Last page"
          >&raquo;</button>
        </span>

        <span class="ogrid-pagination__size">
          <label>Rows
            <select
              [value]="pageSize"
              (change)="onPageSizeSelect($event)"
              aria-label="Rows per page"
            >
              @for (n of vm.pageSizeOptions; track n) {
                <option [value]="n" [selected]="pageSize === n">{{ n }}</option>
              }
            </select>
          </label>
        </span>
      </nav>
    }
  `,
  styles: [`
    :host { display: block; }
    .ogrid-pagination {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 8px; padding: 6px 12px; font-size: 14px;
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-pagination__info { color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6)); }
    .ogrid-pagination__pages { display: flex; align-items: center; gap: 2px; }
    .ogrid-pagination__btn {
      min-width: 32px; height: 32px; padding: 0 6px;
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.23)); border-radius: 4px;
      background: transparent; cursor: pointer; font-size: 14px;
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-pagination__btn:hover:not(:disabled) { background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04)); }
    .ogrid-pagination__btn:disabled { opacity: 0.38; cursor: default; }
    .ogrid-pagination__btn--active {
      background: var(--mat-sys-primary, #1976d2); color: #fff;
      border-color: var(--mat-sys-primary, #1976d2);
    }
    .ogrid-pagination__ellipsis { margin: 0 4px; color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6)); }
    .ogrid-pagination__size { display: flex; align-items: center; gap: 8px; color: var(--ogrid-fg, rgba(0, 0, 0, 0.87)); }
    .ogrid-pagination__size select {
      min-width: 60px; height: 32px; padding: 4px 8px;
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.23)); border-radius: 4px;
      font-size: 14px; margin-left: 8px;
      background: var(--ogrid-bg, #ffffff); color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
  `],
})
export class PaginationControlsComponent extends BasePaginationControlsComponent {}
