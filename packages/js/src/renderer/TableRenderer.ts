import type { IColumnDef } from '../types/columnTypes';
import type { RowId } from '../types/gridTypes';
import { getCellValue, buildHeaderRows } from '@alaarab/ogrid-core';
import type { GridState } from '../state/GridState';

export class TableRenderer<T> {
  private container: HTMLElement;
  private state: GridState<T>;
  private table: HTMLTableElement | null = null;
  private thead: HTMLTableSectionElement | null = null;
  private tbody: HTMLTableSectionElement | null = null;

  constructor(container: HTMLElement, state: GridState<T>) {
    this.container = container;
    this.state = state;
  }

  /** Full render — creates the table structure from scratch. */
  render(): void {
    // Clear container
    this.container.innerHTML = '';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'ogrid-wrapper';
    wrapper.setAttribute('role', 'grid');
    const ariaLabel = (this.state as unknown as { _ariaLabel?: string })._ariaLabel;
    if (ariaLabel) {
      wrapper.setAttribute('aria-label', ariaLabel);
    }

    // Create table
    this.table = document.createElement('table');
    this.table.className = 'ogrid-table';

    // Render header
    this.thead = document.createElement('thead');
    this.renderHeader();
    this.table.appendChild(this.thead);

    // Render body
    this.tbody = document.createElement('tbody');
    this.renderBody();
    this.table.appendChild(this.tbody);

    wrapper.appendChild(this.table);
    this.container.appendChild(wrapper);
  }

  /** Re-render body rows and header (after sort/filter/page change). */
  update(): void {
    if (!this.tbody || !this.thead) {
      this.render();
      return;
    }
    this.thead.innerHTML = '';
    this.renderHeader();
    this.tbody.innerHTML = '';
    this.renderBody();
  }

  private renderHeader(): void {
    if (!this.thead) return;
    this.thead.innerHTML = '';

    const visibleCols = this.state.visibleColumnDefs;
    // buildHeaderRows expects core column types - cast through unknown
    const headerRows = buildHeaderRows(this.state.allColumns as unknown as Parameters<typeof buildHeaderRows>[0], this.state.visibleColumns);

    // If we have grouped headers (more than 1 row), render all rows
    if (headerRows.length > 1) {
      for (const row of headerRows) {
        const tr = document.createElement('tr');
        for (const cell of row) {
          const th = document.createElement('th');
          th.textContent = cell.label;
          th.className = cell.isGroup ? 'ogrid-group-header' : 'ogrid-header-cell';
          if (cell.colSpan > 1) th.colSpan = cell.colSpan;

          if (!cell.isGroup && cell.columnDef?.sortable) {
            th.classList.add('ogrid-sortable');
            th.addEventListener('click', () => {
              if (cell.columnDef) {
                this.state.toggleSort(cell.columnDef.columnId);
              }
            });

            // Sort indicator
            const sort = this.state.sort;
            if (sort && cell.columnDef && sort.field === cell.columnDef.columnId) {
              const indicator = document.createElement('span');
              indicator.className = 'ogrid-sort-indicator';
              indicator.textContent = sort.direction === 'asc' ? ' \u25B2' : ' \u25BC';
              th.appendChild(indicator);
            }
          }

          tr.appendChild(th);
        }
        this.thead!.appendChild(tr);
      }
    } else {
      // Single row header
      const tr = document.createElement('tr');
      for (const col of visibleCols) {
        const th = document.createElement('th');
        th.textContent = col.name;
        th.className = 'ogrid-header-cell';
        th.setAttribute('data-column-id', col.columnId);

        if (col.sortable) {
          th.classList.add('ogrid-sortable');
          th.addEventListener('click', () => this.state.toggleSort(col.columnId));

          const sort = this.state.sort;
          if (sort && sort.field === col.columnId) {
            const indicator = document.createElement('span');
            indicator.className = 'ogrid-sort-indicator';
            indicator.textContent = sort.direction === 'asc' ? ' \u25B2' : ' \u25BC';
            th.appendChild(indicator);
          }
        }

        if (col.type === 'numeric') {
          th.style.textAlign = 'right';
        }

        tr.appendChild(th);
      }
      this.thead!.appendChild(tr);
    }
  }

  private renderBody(): void {
    if (!this.tbody) return;

    const visibleCols = this.state.visibleColumnDefs;
    const { items } = this.state.getProcessedItems();

    if (items.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = visibleCols.length;
      td.className = 'ogrid-empty-state';
      td.textContent = 'No data';
      tr.appendChild(td);
      this.tbody.appendChild(tr);
      return;
    }

    for (const item of items) {
      const rowId = this.state.getRowId(item);
      const tr = document.createElement('tr');
      tr.className = 'ogrid-row';
      tr.setAttribute('data-row-id', String(rowId));

      for (const col of visibleCols) {
        const td = document.createElement('td');
        td.className = 'ogrid-cell';
        td.setAttribute('data-column-id', col.columnId);

        if (col.type === 'numeric') {
          td.style.textAlign = 'right';
        }

        // Custom DOM render
        if (col.renderCell) {
          // Cast col to unknown first to work around structural differences
          const value = getCellValue(item, col as unknown as Parameters<typeof getCellValue>[1]);
          col.renderCell(td, item, value);
        } else {
          // Default: text content via valueFormatter or toString
          const value = getCellValue(item, col as unknown as Parameters<typeof getCellValue>[1]);
          if (col.valueFormatter) {
            td.textContent = col.valueFormatter(value, item);
          } else if (value != null) {
            td.textContent = String(value);
          }
        }

        // Apply cell styles
        if (col.cellStyle) {
          const styles = typeof col.cellStyle === 'function' ? col.cellStyle(item) : col.cellStyle;
          if (styles) {
            Object.assign(td.style, styles);
          }
        }

        tr.appendChild(td);
      }

      this.tbody.appendChild(tr);
    }
  }

  destroy(): void {
    this.container.innerHTML = '';
    this.table = null;
    this.thead = null;
    this.tbody = null;
  }
}
