import type { GridState } from '../state/GridState';
import { getPaginationViewModel } from '@alaarab/ogrid-core';

export class PaginationControls<T> {
  private container: HTMLElement;
  private state: GridState<T>;
  private el: HTMLElement | null = null;

  constructor(container: HTMLElement, state: GridState<T>) {
    this.container = container;
    this.state = state;
  }

  render(totalCount: number): void {
    if (this.el) this.el.remove();

    const vm = getPaginationViewModel(this.state.page, this.state.pageSize, totalCount);
    if (!vm) return; // No pagination if totalCount is 0

    this.el = document.createElement('div');
    this.el.className = 'ogrid-pagination';

    // Page size selector
    const pageSizeDiv = document.createElement('div');
    pageSizeDiv.className = 'ogrid-pagination-size';
    const label = document.createElement('span');
    label.textContent = 'Rows per page: ';
    pageSizeDiv.appendChild(label);

    const select = document.createElement('select');
    select.className = 'ogrid-page-size-select';
    for (const size of vm.pageSizeOptions) {
      const option = document.createElement('option');
      option.value = String(size);
      option.textContent = String(size);
      option.selected = size === this.state.pageSize;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      this.state.setPageSize(Number(select.value));
    });
    pageSizeDiv.appendChild(select);
    this.el.appendChild(pageSizeDiv);

    // Page info
    const info = document.createElement('span');
    info.className = 'ogrid-pagination-info';
    info.textContent = `${vm.startItem}-${vm.endItem} of ${totalCount}`;
    this.el.appendChild(info);

    // Navigation buttons
    const nav = document.createElement('div');
    nav.className = 'ogrid-pagination-nav';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '\u25C0';
    prevBtn.className = 'ogrid-pagination-btn';
    prevBtn.disabled = this.state.page === 1;
    prevBtn.addEventListener('click', () => this.state.setPage(this.state.page - 1));
    nav.appendChild(prevBtn);

    // Start ellipsis
    if (vm.showStartEllipsis) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      ellipsis.className = 'ogrid-pagination-ellipsis';
      nav.appendChild(ellipsis);
    }

    // Page number buttons
    for (const pageNum of vm.pageNumbers) {
      const btn = document.createElement('button');
      btn.textContent = String(pageNum);
      btn.className = 'ogrid-pagination-btn' + (pageNum === this.state.page ? ' ogrid-pagination-active' : '');
      btn.addEventListener('click', () => this.state.setPage(pageNum));
      nav.appendChild(btn);
    }

    // End ellipsis
    if (vm.showEndEllipsis) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      ellipsis.className = 'ogrid-pagination-ellipsis';
      nav.appendChild(ellipsis);
    }

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '\u25B6';
    nextBtn.className = 'ogrid-pagination-btn';
    nextBtn.disabled = this.state.page === vm.totalPages;
    nextBtn.addEventListener('click', () => this.state.setPage(this.state.page + 1));
    nav.appendChild(nextBtn);

    this.el.appendChild(nav);
    this.container.appendChild(this.el);
  }

  destroy(): void {
    this.el?.remove();
    this.el = null;
  }
}
