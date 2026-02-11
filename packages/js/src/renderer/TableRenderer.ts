import type { RowId } from '../types/gridTypes';
import type { IActiveCell, ISelectionRange } from '@alaarab/ogrid-core';
import { getCellValue, buildHeaderRows, isInSelectionRange } from '@alaarab/ogrid-core';
import type { GridState } from '../state/GridState';
import type { HeaderFilterState, HeaderFilterConfig } from '../state/HeaderFilterState';

export interface TableRendererInteractionState {
  activeCell: IActiveCell | null;
  selectionRange: ISelectionRange | null;
  copyRange: ISelectionRange | null;
  cutRange: ISelectionRange | null;
  editingCell: { rowId: RowId; columnId: string } | null;
  columnWidths: Record<string, number>;
  onCellClick?: (rowIndex: number, colIndex: number, e: MouseEvent) => void;
  onCellMouseDown?: (rowIndex: number, colIndex: number, e: MouseEvent) => void;
  onCellDoubleClick?: (rowIndex: number, colIndex: number, rowId: RowId, columnId: string) => void;
  onCellContextMenu?: (rowIndex: number, colIndex: number, e: MouseEvent) => void;
  onResizeStart?: (columnId: string, clientX: number, currentWidth: number) => void;
  // Fill handle
  onFillHandleMouseDown?: (e: MouseEvent) => void;
  // Row selection
  rowSelectionMode?: 'single' | 'multiple' | 'none';
  selectedRowIds?: Set<RowId>;
  onRowCheckboxChange?: (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  allSelected?: boolean;
  someSelected?: boolean;
  // Column pinning
  pinnedColumns?: Record<string, 'left' | 'right'>;
  leftOffsets?: Record<string, number>;
  rightOffsets?: Record<string, number>;
}

const CHECKBOX_COL_WIDTH = 40;

export class TableRenderer<T> {
  private container: HTMLElement;
  private state: GridState<T>;
  private table: HTMLTableElement | null = null;
  private thead: HTMLTableSectionElement | null = null;
  private tbody: HTMLTableSectionElement | null = null;
  private interactionState: TableRendererInteractionState | null = null;
  private wrapperEl: HTMLDivElement | null = null;
  private headerFilterState: HeaderFilterState | null = null;
  private filterConfigs: Map<string, HeaderFilterConfig> = new Map();
  private onFilterIconClick: ((columnId: string, headerEl: HTMLElement) => void) | null = null;

  constructor(container: HTMLElement, state: GridState<T>) {
    this.container = container;
    this.state = state;
  }

  setHeaderFilterState(state: HeaderFilterState, configs: Map<string, HeaderFilterConfig>): void {
    this.headerFilterState = state;
    this.filterConfigs = configs;
  }

  setOnFilterIconClick(handler: (columnId: string, headerEl: HTMLElement) => void): void {
    this.onFilterIconClick = handler;
  }

  setInteractionState(state: TableRendererInteractionState | null): void {
    this.interactionState = state;
  }

  getWrapperElement(): HTMLDivElement | null {
    return this.wrapperEl;
  }

  /** Full render — creates the table structure from scratch. */
  render(): void {
    // Clear container
    this.container.innerHTML = '';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'ogrid-wrapper';
    wrapper.setAttribute('role', 'grid');
    wrapper.setAttribute('tabindex', '0'); // Make focusable for keyboard nav
    wrapper.style.position = 'relative'; // For MarchingAnts absolute positioning
    const ariaLabel = (this.state as unknown as { _ariaLabel?: string })._ariaLabel;
    if (ariaLabel) {
      wrapper.setAttribute('aria-label', ariaLabel);
    }
    this.wrapperEl = wrapper;

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

  private hasCheckboxColumn(): boolean {
    const mode = this.interactionState?.rowSelectionMode;
    return mode === 'single' || mode === 'multiple';
  }

  /** The column index offset for data columns (1 if checkbox column present, else 0). */
  getColOffset(): number {
    return this.hasCheckboxColumn() ? 1 : 0;
  }

  private applyPinningStyles(
    el: HTMLElement,
    columnId: string,
    isHeader: boolean
  ): void {
    const is = this.interactionState;
    if (!is?.pinnedColumns) return;

    const side = is.pinnedColumns[columnId];
    if (!side) return;

    el.style.position = 'sticky';
    el.style.zIndex = isHeader ? '3' : '1';
    el.setAttribute('data-pinned', side);

    if (side === 'left' && is.leftOffsets) {
      el.style.left = `${is.leftOffsets[columnId] ?? 0}px`;
    } else if (side === 'right' && is.rightOffsets) {
      el.style.right = `${is.rightOffsets[columnId] ?? 0}px`;
    }

    // Background must be set on pinned cells to avoid showing content underneath
    if (!isHeader) {
      el.style.backgroundColor = el.style.backgroundColor || '#fff';
    }
  }

  private renderHeader(): void {
    if (!this.thead) return;
    this.thead.innerHTML = '';

    const visibleCols = this.state.visibleColumnDefs;
    const hasCheckbox = this.hasCheckboxColumn();
    // buildHeaderRows expects core column types - cast through unknown
    const headerRows = buildHeaderRows(this.state.allColumns as unknown as Parameters<typeof buildHeaderRows>[0], this.state.visibleColumns);

    // If we have grouped headers (more than 1 row), render all rows
    if (headerRows.length > 1) {
      for (const row of headerRows) {
        const tr = document.createElement('tr');
        if (hasCheckbox) {
          const th = document.createElement('th');
          th.className = 'ogrid-header-cell ogrid-checkbox-header';
          th.style.width = `${CHECKBOX_COL_WIDTH}px`;
          // Select-all checkbox only on last header row
          if (row === headerRows[headerRows.length - 1]) {
            this.appendSelectAllCheckbox(th);
          }
          tr.appendChild(th);
        }
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

          if (!cell.isGroup && cell.columnDef) {
            this.applyPinningStyles(th, cell.columnDef.columnId, true);
          }

          tr.appendChild(th);
        }
        this.thead!.appendChild(tr);
      }
    } else {
      // Single row header
      const tr = document.createElement('tr');

      // Checkbox header
      if (hasCheckbox) {
        const th = document.createElement('th');
        th.className = 'ogrid-header-cell ogrid-checkbox-header';
        th.style.width = `${CHECKBOX_COL_WIDTH}px`;
        this.appendSelectAllCheckbox(th);
        tr.appendChild(th);
      }

      for (let colIdx = 0; colIdx < visibleCols.length; colIdx++) {
        const col = visibleCols[colIdx];
        const th = document.createElement('th');
        th.className = 'ogrid-header-cell';
        th.setAttribute('data-column-id', col.columnId);

        // Text container
        const textSpan = document.createElement('span');
        textSpan.textContent = col.name;
        th.appendChild(textSpan);

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

        // Apply column width from resize state
        if (this.interactionState?.columnWidths[col.columnId]) {
          th.style.width = `${this.interactionState.columnWidths[col.columnId]}px`;
        }

        // Column pinning
        this.applyPinningStyles(th, col.columnId, true);

        // Add resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'ogrid-resize-handle';
        resizeHandle.style.position = 'absolute';
        resizeHandle.style.right = '0';
        resizeHandle.style.top = '0';
        resizeHandle.style.bottom = '0';
        resizeHandle.style.width = '4px';
        resizeHandle.style.cursor = 'col-resize';
        resizeHandle.style.userSelect = 'none';
        th.style.position = th.style.position || 'relative';
        th.appendChild(resizeHandle);

        resizeHandle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          const rect = th.getBoundingClientRect();
          this.interactionState?.onResizeStart?.(col.columnId, e.clientX, rect.width);
        });

        // Filter icon (if column is filterable)
        const filterConfig = this.filterConfigs.get(col.columnId);
        if (filterConfig && this.onFilterIconClick) {
          const filterBtn = document.createElement('button');
          filterBtn.className = 'ogrid-filter-icon';
          filterBtn.setAttribute('aria-label', `Filter ${col.name}`);
          filterBtn.style.border = 'none';
          filterBtn.style.background = 'transparent';
          filterBtn.style.cursor = 'pointer';
          filterBtn.style.fontSize = '10px';
          filterBtn.style.padding = '0 2px';
          filterBtn.style.marginLeft = '4px';
          filterBtn.style.color = 'var(--ogrid-fg, #242424)';
          filterBtn.style.opacity = '0.6';

          // Show active filter indicator
          const hasActive = this.headerFilterState?.hasActiveFilter(filterConfig);
          filterBtn.textContent = hasActive ? '\u25BC' : '\u25BD';
          if (hasActive) {
            filterBtn.style.opacity = '1';
            filterBtn.style.color = 'var(--ogrid-selection, #217346)';
          }

          filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.onFilterIconClick?.(col.columnId, th);
          });

          th.appendChild(filterBtn);
        }

        tr.appendChild(th);
      }
      this.thead!.appendChild(tr);
    }
  }

  private appendSelectAllCheckbox(th: HTMLElement): void {
    const is = this.interactionState;
    if (is?.rowSelectionMode !== 'multiple') return;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'ogrid-select-all-checkbox';
    checkbox.checked = is?.allSelected === true;
    checkbox.indeterminate = is?.someSelected === true;
    checkbox.setAttribute('aria-label', 'Select all rows');
    checkbox.addEventListener('change', () => {
      is?.onSelectAll?.(checkbox.checked);
    });
    th.appendChild(checkbox);
  }

  private renderBody(): void {
    if (!this.tbody) return;

    const visibleCols = this.state.visibleColumnDefs;
    const { items } = this.state.getProcessedItems();
    const hasCheckbox = this.hasCheckboxColumn();
    const colOffset = this.getColOffset();

    if (items.length === 0 && !this.state.isLoading) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = visibleCols.length + colOffset;
      td.className = 'ogrid-empty-state';
      td.textContent = 'No data';
      tr.appendChild(td);
      this.tbody.appendChild(tr);
      return;
    }

    for (let rowIndex = 0; rowIndex < items.length; rowIndex++) {
      const item = items[rowIndex];
      const rowId = this.state.getRowId(item);
      const tr = document.createElement('tr');
      tr.className = 'ogrid-row';
      tr.setAttribute('data-row-id', String(rowId));

      // Row selection state
      const isRowSelected = this.interactionState?.selectedRowIds?.has(rowId) === true;
      if (isRowSelected) {
        tr.setAttribute('data-row-selected', 'true');
      }

      // Checkbox column
      if (hasCheckbox) {
        const td = document.createElement('td');
        td.className = 'ogrid-cell ogrid-checkbox-cell';
        td.style.width = `${CHECKBOX_COL_WIDTH}px`;
        td.style.textAlign = 'center';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'ogrid-row-checkbox';
        checkbox.checked = isRowSelected;
        checkbox.setAttribute('aria-label', `Select row ${rowId}`);
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation(); // Don't trigger cell click
          this.interactionState?.onRowCheckboxChange?.(rowId, checkbox.checked, rowIndex, e.shiftKey);
        });
        td.appendChild(checkbox);
        tr.appendChild(td);
      }

      for (let colIndex = 0; colIndex < visibleCols.length; colIndex++) {
        const col = visibleCols[colIndex];
        const globalColIndex = colIndex + colOffset;
        const td = document.createElement('td');
        td.className = 'ogrid-cell';
        td.setAttribute('data-column-id', col.columnId);
        td.setAttribute('data-row-index', String(rowIndex));
        td.setAttribute('data-col-index', String(globalColIndex));
        td.setAttribute('tabindex', '-1'); // Make focusable

        if (col.type === 'numeric') {
          td.style.textAlign = 'right';
        }

        // Column pinning
        this.applyPinningStyles(td, col.columnId, false);

        // Apply interaction state
        if (this.interactionState) {
          const { activeCell, selectionRange, copyRange, cutRange, editingCell } = this.interactionState;

          // Active cell
          if (activeCell && activeCell.rowIndex === rowIndex && activeCell.columnIndex === globalColIndex) {
            td.setAttribute('data-active-cell', 'true');
            td.style.outline = '2px solid #0078d4';
          }

          // Selection range
          if (selectionRange && isInSelectionRange(selectionRange, rowIndex, colIndex)) {
            td.setAttribute('data-in-range', 'true');
            td.style.backgroundColor = '#e3f2fd';
          }

          // Copy range
          if (copyRange && isInSelectionRange(copyRange, rowIndex, colIndex)) {
            td.style.outline = '1px dashed #666';
          }

          // Cut range
          if (cutRange && isInSelectionRange(cutRange, rowIndex, colIndex)) {
            td.style.outline = '1px dashed #d32f2f';
          }

          // Editing cell (hide content, editor overlay will be shown)
          if (editingCell && editingCell.rowId === rowId && editingCell.columnId === col.columnId) {
            td.style.visibility = 'hidden';
          }

          // Cell interaction handlers
          td.addEventListener('click', (e) => {
            this.interactionState?.onCellClick?.(rowIndex, globalColIndex, e);
          });

          td.addEventListener('mousedown', (e) => {
            this.interactionState?.onCellMouseDown?.(rowIndex, globalColIndex, e);
          });

          td.addEventListener('dblclick', () => {
            this.interactionState?.onCellDoubleClick?.(rowIndex, globalColIndex, rowId, col.columnId);
          });

          td.addEventListener('contextmenu', (e) => {
            this.interactionState?.onCellContextMenu?.(rowIndex, globalColIndex, e);
          });

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

        // Fill handle: render on the bottom-right cell of the selection range
        // Must be AFTER cell content (td.textContent removes child nodes)
        if (this.interactionState) {
          const { selectionRange } = this.interactionState;
          if (
            selectionRange &&
            this.interactionState.onFillHandleMouseDown &&
            rowIndex === Math.max(selectionRange.startRow, selectionRange.endRow) &&
            colIndex === Math.max(selectionRange.startCol, selectionRange.endCol)
          ) {
            const fillHandle = document.createElement('div');
            fillHandle.className = 'ogrid-fill-handle';
            fillHandle.setAttribute('data-fill-handle', 'true');
            fillHandle.style.position = 'absolute';
            fillHandle.style.right = '-3px';
            fillHandle.style.bottom = '-3px';
            fillHandle.style.width = '6px';
            fillHandle.style.height = '6px';
            fillHandle.style.backgroundColor = 'var(--ogrid-selection, #217346)';
            fillHandle.style.cursor = 'crosshair';
            fillHandle.style.zIndex = '5';
            td.style.position = td.style.position || 'relative';

            fillHandle.addEventListener('mousedown', (e) => {
              this.interactionState?.onFillHandleMouseDown?.(e);
            });

            td.appendChild(fillHandle);
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
