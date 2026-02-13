import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePaginationControlsComponent } from '@alaarab/ogrid-angular';

/**
 * Pagination controls component for Angular Radix (lightweight styling).
 * Standalone component with inline template and CSS variables for theming.
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
          >⏮</button>
          <button
            class="ogrid-pagination__btn"
            [disabled]="currentPage === 1"
            (click)="pageChange.emit(currentPage - 1)"
            aria-label="Previous page"
          >◀</button>

          @if (vm.showStartEllipsis) {
            <button class="ogrid-pagination__btn" (click)="pageChange.emit(1)" aria-label="Page 1">1</button>
            <span class="ogrid-pagination__ellipsis" aria-hidden="true">…</span>
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
            <span class="ogrid-pagination__ellipsis" aria-hidden="true">…</span>
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
          >▶</button>
          <button
            class="ogrid-pagination__btn"
            [disabled]="currentPage >= vm.totalPages"
            (click)="pageChange.emit(vm.totalPages)"
            aria-label="Last page"
          >⏭</button>
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
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      padding: 6px 12px;
      font-size: 14px;
      background: var(--ogrid-bg, #ffffff);
    }
    .ogrid-pagination__info {
      color: var(--ogrid-fg, #242424);
      opacity: 0.7;
    }
    .ogrid-pagination__pages {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .ogrid-pagination__btn {
      min-width: 32px;
      height: 32px;
      padding: 0 8px;
      border: 1px solid var(--ogrid-border, #e0e0e0);
      border-radius: 4px;
      background: var(--ogrid-bg, #ffffff);
      color: var(--ogrid-fg, #242424);
      cursor: pointer;
      font-size: 14px;
      transition: all 0.15s ease;
    }
    .ogrid-pagination__btn:hover:not(:disabled) {
      background: var(--ogrid-hover-bg, #f0f0f0);
      border-color: var(--ogrid-active-border, #0078d4);
    }
    .ogrid-pagination__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .ogrid-pagination__btn--active {
      background: var(--ogrid-active-border, #0078d4);
      color: #ffffff;
      border-color: var(--ogrid-active-border, #0078d4);
      font-weight: 600;
    }
    .ogrid-pagination__ellipsis {
      margin: 0 4px;
      color: var(--ogrid-fg, #242424);
      opacity: 0.6;
    }
    .ogrid-pagination__size {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--ogrid-fg, #242424);
    }
    .ogrid-pagination__size select {
      min-width: 60px;
      height: 32px;
      padding: 4px 8px;
      border: 1px solid var(--ogrid-border, #e0e0e0);
      border-radius: 4px;
      background: var(--ogrid-bg, #ffffff);
      color: var(--ogrid-fg, #242424);
      font-size: 14px;
      margin-left: 8px;
      cursor: pointer;
    }
    .ogrid-pagination__size select:focus {
      outline: 2px solid var(--ogrid-active-border, #0078d4);
      outline-offset: 1px;
    }
  `],
})
export class PaginationControlsComponent extends BasePaginationControlsComponent {}
