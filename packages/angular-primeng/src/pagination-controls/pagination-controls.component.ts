import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePaginationControlsComponent } from '@alaarab/ogrid-angular';

@Component({
  selector: 'ogrid-primeng-pagination-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm()) {
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--ogrid-fg, #242424)">
        <div>
          Showing {{ vm()!.startItem }} to {{ vm()!.endItem }} of {{ totalCount.toLocaleString() }} {{ labelPlural() }}
        </div>

        <div style="display:flex;align-items:center;gap:4px" role="navigation" aria-label="Pagination">
          <button
            type="button"
            class="p-button p-button-text p-button-sm"
            [disabled]="currentPage === 1"
            (click)="pageChange.emit(1)"
            aria-label="First page"
            style="min-width:32px;padding:4px 8px"
          >&laquo;</button>
          <button
            type="button"
            class="p-button p-button-text p-button-sm"
            [disabled]="currentPage === 1"
            (click)="pageChange.emit(currentPage - 1)"
            aria-label="Previous page"
            style="min-width:32px;padding:4px 8px"
          >&lsaquo;</button>

          @if (vm()!.showStartEllipsis) {
            <button
              type="button"
              class="p-button p-button-text p-button-sm"
              (click)="pageChange.emit(1)"
              aria-label="Page 1"
              style="min-width:32px;padding:4px 8px"
            >1</button>
            <span aria-hidden style="padding:0 4px">&hellip;</span>
          }

          @for (pageNum of vm()!.pageNumbers; track pageNum) {
            <button
              type="button"
              class="p-button p-button-sm"
              [class.p-button-outlined]="currentPage !== pageNum"
              (click)="pageChange.emit(pageNum)"
              [attr.aria-label]="'Page ' + pageNum"
              [attr.aria-current]="currentPage === pageNum ? 'page' : null"
              style="min-width:32px;padding:4px 8px"
            >{{ pageNum }}</button>
          }

          @if (vm()!.showEndEllipsis) {
            <span aria-hidden style="padding:0 4px">&hellip;</span>
            <button
              type="button"
              class="p-button p-button-text p-button-sm"
              (click)="pageChange.emit(vm()!.totalPages)"
              [attr.aria-label]="'Page ' + vm()!.totalPages"
              style="min-width:32px;padding:4px 8px"
            >{{ vm()!.totalPages }}</button>
          }

          <button
            type="button"
            class="p-button p-button-text p-button-sm"
            [disabled]="currentPage >= vm()!.totalPages"
            (click)="pageChange.emit(currentPage + 1)"
            aria-label="Next page"
            style="min-width:32px;padding:4px 8px"
          >&rsaquo;</button>
          <button
            type="button"
            class="p-button p-button-text p-button-sm"
            [disabled]="currentPage >= vm()!.totalPages"
            (click)="pageChange.emit(vm()!.totalPages)"
            aria-label="Last page"
            style="min-width:32px;padding:4px 8px"
          >&raquo;</button>
        </div>

        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:12px">Rows</span>
          <select
            [value]="'' + pageSize"
            (change)="onPageSizeChange($any($event.target).value)"
            aria-label="Rows per page"
            style="padding:4px 6px;border:1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));border-radius:4px;background:var(--ogrid-bg, #fff);color:var(--ogrid-fg, #242424)"
          >
            @for (opt of vm()!.pageSizeOptions; track opt) {
              <option [value]="opt">{{ opt }}</option>
            }
          </select>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    @media (max-width: 576px) {
      :host ::ng-deep > div { flex-direction: column; align-items: stretch !important; gap: 6px !important; padding: 6px 8px; font-size: 12px !important; }
      :host ::ng-deep > div > div:nth-child(2) { order: -1; justify-content: center; }
      :host ::ng-deep > div > div:first-child { text-align: center; font-size: 11px !important; }
      :host ::ng-deep > div > div:last-child { font-size: 11px !important; justify-content: center; }
    }
  `],
})
export class PaginationControlsComponent extends BasePaginationControlsComponent {}
