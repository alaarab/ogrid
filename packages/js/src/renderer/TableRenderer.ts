import type { RowId, CellEvent } from '../types/gridTypes';
import type { IActiveCell, ISelectionRange } from '@alaarab/ogrid-core';
import { getCellValue, buildHeaderRows, isInSelectionRange, ROW_NUMBER_COLUMN_WIDTH, ROW_NUMBER_COLUMN_ID, CHECKBOX_COLUMN_WIDTH, partitionColumnsForVirtualization, indexToColumnLetter } from '@alaarab/ogrid-core';
import type { GridState } from '../state/GridState';
import type { HeaderFilterState, HeaderFilterConfig } from '../state/HeaderFilterState';
import type { VirtualScrollState } from '../state/VirtualScrollState';
import type { FormulaEngineState } from '../state/FormulaEngineState';
import { getCellCoordinates } from '../utils/getCellCoordinates';

/** Pre-computed range bounds for fast in-range checks (avoids repeated Math.min/max). */
interface RangeBounds { minR: number; maxR: number; minC: number; maxC: number; }

function rangeBounds(r: ISelectionRange): RangeBounds {
  return {
    minR: Math.min(r.startRow, r.endRow),
    maxR: Math.max(r.startRow, r.endRow),
    minC: Math.min(r.startCol, r.endCol),
    maxC: Math.max(r.startCol, r.endCol),
  };
}

function inBounds(b: RangeBounds, row: number, col: number): boolean {
  return row >= b.minR && row <= b.maxR && col >= b.minC && col <= b.maxC;
}

export interface TableRendererInteractionState {
  activeCell: IActiveCell | null;
  selectionRange: ISelectionRange | null;
  copyRange: ISelectionRange | null;
  cutRange: ISelectionRange | null;
  editingCell: { rowId: RowId; columnId: string } | null;
  columnWidths: Record<string, number>;
  onCellClick?: (cellEvent: CellEvent) => void;
  onCellMouseDown?: (cellEvent: CellEvent) => void;
  onCellDoubleClick?: (cellEvent: CellEvent) => void;
  onCellContextMenu?: (cellEvent: CellEvent) => void;
  onResizeStart?: (columnId: string, clientX: number, currentWidth: number) => void;
  onResizeDoubleClick?: (columnId: string) => void;
  // Fill handle
  onFillHandleMouseDown?: (e: PointerEvent) => void;
  // Row selection
  rowSelectionMode?: 'single' | 'multiple' | 'none';
  selectedRowIds?: Set<RowId>;
  onRowCheckboxChange?: (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  allSelected?: boolean;
  someSelected?: boolean;
  // Row numbers
  showRowNumbers?: boolean;
  // Column letters
  showColumnLetters?: boolean;
  // Name box
  showNameBox?: boolean;
  // Column pinning
  pinnedColumns?: Record<string, 'left' | 'right'>;
  leftOffsets?: Record<string, number>;
  rightOffsets?: Record<string, number>;
  // Column reorder
  onColumnReorderStart?: (columnId: string, event: PointerEvent) => void;
}


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
  private dropIndicator: HTMLDivElement | null = null;
  private virtualScrollState: VirtualScrollState | null = null;

  // Delegated event handlers bound to tbody
  private _tbodyClickHandler: ((e: MouseEvent) => void) | null = null;
  private _tbodyPointerdownHandler: ((e: PointerEvent) => void) | null = null;
  private _tbodyDblclickHandler: ((e: MouseEvent) => void) | null = null;
  private _tbodyContextmenuHandler: ((e: MouseEvent) => void) | null = null;

  // Delegated event handlers bound to thead (avoids per-<th> inline listeners)
  private _theadClickHandler: ((e: MouseEvent) => void) | null = null;
  private _theadPointerdownHandler: ((e: PointerEvent) => void) | null = null;
  private _theadDblclickHandler: ((e: MouseEvent) => void) | null = null;

  // State tracking for incremental DOM patching
  private lastActiveCell: IActiveCell | null = null;
  private lastSelectionRange: ISelectionRange | null = null;
  private lastCopyRange: ISelectionRange | null = null;
  private lastCutRange: ISelectionRange | null = null;
  private lastEditingCell: { rowId: RowId; columnId: string } | null = null;
  private lastColumnWidths: Record<string, number> = {};
  private lastHeaderSignature: string = '';
  private lastRenderedItems: T[] | null = null;
  private lastRowSelectionMode: string | undefined;
  private lastSelectedRowIds: Set<RowId> | undefined;
  private lastShowRowNumbers: boolean | undefined;
  private lastPinnedColumns: Record<string, 'left' | 'right'> | undefined;
  private lastAllSelected: boolean | undefined;
  private lastSomeSelected: boolean | undefined;
  private formulaEngine: FormulaEngineState | null = null;

  constructor(container: HTMLElement, state: GridState<T>) {
    this.container = container;
    this.state = state;
  }

  setFormulaEngine(engine: FormulaEngineState): void {
    this.formulaEngine = engine;
  }

  setVirtualScrollState(vs: VirtualScrollState): void {
    this.virtualScrollState = vs;
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

  private getCellFromEvent(e: MouseEvent | PointerEvent): { el: HTMLElement; rowIndex: number; colIndex: number } | null {
    const target = e.target as HTMLElement;
    const cell = target.closest('td[data-row-index]') as HTMLElement | null;
    if (!cell) return null;
    const coords = getCellCoordinates(cell);
    if (!coords) return null;
    return { el: cell, rowIndex: coords.rowIndex, colIndex: coords.colIndex };
  }

  private attachBodyDelegation(): void {
    if (!this.tbody) return;

    this._tbodyClickHandler = (e: MouseEvent) => {
      const cell = this.getCellFromEvent(e);
      if (!cell) return;
      this.interactionState?.onCellClick?.({ rowIndex: cell.rowIndex, colIndex: cell.colIndex, event: e });
    };

    this._tbodyPointerdownHandler = (e: PointerEvent) => {
      // Fill handle pointerdown — delegated from per-cell inline listener
      const target = e.target as HTMLElement;
      if (target.classList.contains('ogrid-fill-handle') || target.getAttribute('data-fill-handle') === 'true') {
        this.interactionState?.onFillHandleMouseDown?.(e);
        return;
      }
      const cell = this.getCellFromEvent(e);
      if (!cell) return;
      this.interactionState?.onCellMouseDown?.({ rowIndex: cell.rowIndex, colIndex: cell.colIndex, event: e });
    };

    this._tbodyDblclickHandler = (e: MouseEvent) => {
      const cell = this.getCellFromEvent(e);
      if (!cell) return;
      const columnId = cell.el.getAttribute('data-column-id') ?? '';
      // Retrieve the typed rowId by looking up the item at the row index (avoids string/number mismatch from data-row-id)
      const { items } = this.state.getProcessedItems();
      const item = items[cell.rowIndex];
      if (!item) return;
      const rowId = this.state.getRowId(item);
      this.interactionState?.onCellDoubleClick?.({ rowIndex: cell.rowIndex, colIndex: cell.colIndex, rowId, columnId });
    };

    this._tbodyContextmenuHandler = (e: MouseEvent) => {
      const cell = this.getCellFromEvent(e);
      if (!cell) return;
      this.interactionState?.onCellContextMenu?.({ rowIndex: cell.rowIndex, colIndex: cell.colIndex, event: e });
    };

    this.tbody.addEventListener('click', this._tbodyClickHandler, { passive: true });
    this.tbody.addEventListener('pointerdown', this._tbodyPointerdownHandler);
    this.tbody.addEventListener('dblclick', this._tbodyDblclickHandler, { passive: true });
    this.tbody.addEventListener('contextmenu', this._tbodyContextmenuHandler);
  }

  private detachBodyDelegation(): void {
    if (!this.tbody) return;
    if (this._tbodyClickHandler) this.tbody.removeEventListener('click', this._tbodyClickHandler);
    if (this._tbodyPointerdownHandler) this.tbody.removeEventListener('pointerdown', this._tbodyPointerdownHandler);
    if (this._tbodyDblclickHandler) this.tbody.removeEventListener('dblclick', this._tbodyDblclickHandler);
    if (this._tbodyContextmenuHandler) this.tbody.removeEventListener('contextmenu', this._tbodyContextmenuHandler);
    this._tbodyClickHandler = null;
    this._tbodyPointerdownHandler = null;
    this._tbodyDblclickHandler = null;
    this._tbodyContextmenuHandler = null;
  }

  /** Attach delegated event listeners to <thead> for sort clicks, resize, reorder, and filter icon clicks. */
  private attachHeaderDelegation(): void {
    if (!this.thead) return;

    // Sort clicks and filter icon clicks use inline listeners for stale-reference compatibility
    // (tests hold references to <th> elements that become detached after header re-render).
    // Delegation handles resize and column reorder pointerdown events only.
    this._theadClickHandler = null;

    this._theadPointerdownHandler = (e: PointerEvent) => {
      const target = e.target as HTMLElement;

      // Resize handle pointerdown
      if (target.classList.contains('ogrid-resize-handle')) {
        e.stopPropagation();
        // Check for data-column-id on the resize handle itself (row number column)
        // or on the parent <th>
        const handleColumnId = target.getAttribute('data-column-id');
        const th = target.closest('th[data-column-id]') as HTMLElement | null;
        const columnId = handleColumnId ?? th?.getAttribute('data-column-id');
        if (columnId) {
          const parentTh = target.closest('th') as HTMLElement | null;
          const rect = parentTh?.getBoundingClientRect();
          this.interactionState?.onResizeStart?.(columnId, e.clientX, rect?.width ?? ROW_NUMBER_COLUMN_WIDTH);
        }
        return;
      }

      // Don't start reorder from filter icon
      if (target.classList.contains('ogrid-filter-icon')) return;

      // Column reorder pointerdown
      if (this.interactionState?.onColumnReorderStart) {
        const th = target.closest('th[data-column-id]') as HTMLElement | null;
        if (!th) return;
        const columnId = th.getAttribute('data-column-id');
        if (columnId) {
          this.interactionState.onColumnReorderStart(columnId, e);
        }
      }
    };

    this._theadDblclickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('ogrid-resize-handle')) {
        e.stopPropagation();
        const handleColumnId = target.getAttribute('data-column-id');
        const th = target.closest('th[data-column-id]') as HTMLElement | null;
        const columnId = handleColumnId ?? th?.getAttribute('data-column-id');
        if (columnId) {
          this.interactionState?.onResizeDoubleClick?.(columnId);
        }
      }
    };

    if (this._theadClickHandler) this.thead.addEventListener('click', this._theadClickHandler);
    this.thead.addEventListener('pointerdown', this._theadPointerdownHandler);
    this.thead.addEventListener('dblclick', this._theadDblclickHandler);
  }

  private detachHeaderDelegation(): void {
    if (!this.thead) return;
    if (this._theadClickHandler) this.thead.removeEventListener('click', this._theadClickHandler);
    if (this._theadPointerdownHandler) this.thead.removeEventListener('pointerdown', this._theadPointerdownHandler);
    if (this._theadDblclickHandler) this.thead.removeEventListener('dblclick', this._theadDblclickHandler);
    this._theadClickHandler = null;
    this._theadPointerdownHandler = null;
    this._theadDblclickHandler = null;
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
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('tabindex', '0'); // Make focusable for keyboard nav
    wrapper.style.position = 'relative'; // For MarchingAnts absolute positioning
    if (this.state.rowHeight) {
      wrapper.style.setProperty('--ogrid-row-height', `${this.state.rowHeight}px`);
    }
    const label = this.state.ariaLabel ?? 'Data grid';
    wrapper.setAttribute('aria-label', label);
    this.wrapperEl = wrapper;

    // Create table
    this.table = document.createElement('table');
    this.table.className = 'ogrid-table';
    this.table.setAttribute('role', 'grid');
    if (this.virtualScrollState) {
      this.table.setAttribute('data-virtual-scroll', '');
    }

    // Render header
    this.thead = document.createElement('thead');
    if (this.state.stickyHeader) {
      this.thead.classList.add('ogrid-sticky-header');
    }
    this.renderHeader();
    this.attachHeaderDelegation();
    this.table.appendChild(this.thead);

    // Render body
    this.tbody = document.createElement('tbody');
    this.renderBody();
    this.attachBodyDelegation();
    this.table.appendChild(this.tbody);

    wrapper.appendChild(this.table);

    // Create drop indicator for column reorder (hidden by default)
    this.dropIndicator = document.createElement('div');
    this.dropIndicator.className = 'ogrid-drop-indicator';
    this.dropIndicator.style.display = 'none';
    wrapper.appendChild(this.dropIndicator);

    this.container.appendChild(wrapper);

    this.snapshotState();
  }

  /** Compute a signature string that captures header-affecting state. */
  private computeHeaderSignature(): string {
    const cols = this.state.visibleColumnDefs;
    const is = this.interactionState;
    const parts: string[] = [];
    for (const col of cols) {
      parts.push(col.columnId);
      parts.push(col.name);
      parts.push(is?.columnWidths[col.columnId]?.toString() ?? '');
    }
    // Include sort state
    const sort = this.state.sort;
    if (sort) parts.push(`sort:${sort.field}:${sort.direction}`);
    // Include row selection mode and checkbox header state
    parts.push(`sel:${is?.rowSelectionMode ?? ''}`);
    parts.push(`allSel:${is?.allSelected ?? ''}`);
    parts.push(`someSel:${is?.someSelected ?? ''}`);
    // Include showRowNumbers and row number column width
    parts.push(`rn:${is?.showRowNumbers ?? ''}`);
    if (is?.showRowNumbers) {
      parts.push(`rnw:${is?.columnWidths[ROW_NUMBER_COLUMN_ID] ?? ''}`);
    }
    // Include showColumnLetters
    parts.push(`cl:${is?.showColumnLetters ?? ''}`);
    // Include filter active states
    for (const [colId, config] of this.filterConfigs) {
      const hasActive = this.headerFilterState?.hasActiveFilter(config);
      if (hasActive) parts.push(`flt:${colId}`);
    }
    return parts.join('|');
  }

  /** Save current interaction state for next diff comparison. */
  private snapshotState(): void {
    const is = this.interactionState;
    this.lastActiveCell = is?.activeCell ? { ...is.activeCell } : null;
    this.lastSelectionRange = is?.selectionRange ? { ...is.selectionRange } : null;
    this.lastCopyRange = is?.copyRange ? { ...is.copyRange } : null;
    this.lastCutRange = is?.cutRange ? { ...is.cutRange } : null;
    this.lastEditingCell = is?.editingCell ? { ...is.editingCell } : null;
    this.lastColumnWidths = is?.columnWidths ? { ...is.columnWidths } : {};
    this.lastRowSelectionMode = is?.rowSelectionMode;
    this.lastSelectedRowIds = is?.selectedRowIds ? new Set(is.selectedRowIds) : undefined;
    this.lastShowRowNumbers = is?.showRowNumbers;
    this.lastPinnedColumns = is?.pinnedColumns;
    this.lastAllSelected = is?.allSelected;
    this.lastSomeSelected = is?.someSelected;
    this.lastHeaderSignature = this.computeHeaderSignature();
    const { items } = this.state.getProcessedItems();
    this.lastRenderedItems = items;
  }

  /** Check if only selection/active-cell/copy/cut ranges changed (no data or header changes). */
  private isSelectionOnlyChange(): boolean {
    if (!this.lastRenderedItems) return false;

    const is = this.interactionState;
    const { items } = this.state.getProcessedItems();

    // If data items changed, need full body rebuild
    if (items !== this.lastRenderedItems) return false;

    // If header signature changed, need header rebuild
    const currentHeaderSig = this.computeHeaderSignature();
    if (currentHeaderSig !== this.lastHeaderSignature) return false;

    // If editing cell changed, need body rebuild (visibility toggle on the td)
    const curEdit = is?.editingCell;
    const lastEdit = this.lastEditingCell;
    if (curEdit?.rowId !== lastEdit?.rowId || curEdit?.columnId !== lastEdit?.columnId) return false;

    // If row selection changed, need body rebuild (checkbox states, row attrs)
    if (is?.rowSelectionMode !== this.lastRowSelectionMode) return false;
    if (is?.selectedRowIds !== this.lastSelectedRowIds) {
      // Compare sets
      const curIds = is?.selectedRowIds;
      const lastIds = this.lastSelectedRowIds;
      if (!curIds && !lastIds) { /* both null, ok */ }
      else if (!curIds || !lastIds || curIds.size !== lastIds.size) return false;
      else {
        for (const id of curIds) {
          if (!lastIds.has(id)) return false;
        }
      }
    }

    // If pinning or row numbers changed
    if (is?.showRowNumbers !== this.lastShowRowNumbers) return false;
    if (is?.pinnedColumns !== this.lastPinnedColumns) return false;

    // Otherwise it's just selection/active-cell/copy/cut changes
    return true;
  }

  /** Patch only CSS classes/styles for selection, active cell, copy/cut ranges without rebuilding DOM. */
  private patchSelectionClasses(): void {
    if (!this.tbody || !this.interactionState) return;

    const is = this.interactionState;
    const { activeCell, selectionRange, copyRange, cutRange } = is;
    const lastActive = this.lastActiveCell;
    const lastSelection = this.lastSelectionRange;
    const lastCopy = this.lastCopyRange;
    const lastCut = this.lastCutRange;

    // Pre-compute range bounds once (avoids repeated Math.min/max in isInSelectionRange per cell)
    const selBounds = selectionRange ? rangeBounds(selectionRange) : null;
    const lastSelBounds = lastSelection ? rangeBounds(lastSelection) : null;
    const copyBounds = copyRange ? rangeBounds(copyRange) : null;
    const lastCopyBounds = lastCopy ? rangeBounds(lastCopy) : null;
    const cutBounds = cutRange ? rangeBounds(cutRange) : null;
    const lastCutBounds = lastCut ? rangeBounds(lastCut) : null;

    const colOffset = this.getColOffset();
    const cells = this.tbody.querySelectorAll<HTMLElement>('td[data-row-index][data-col-index]');

    for (let i = 0; i < cells.length; i++) {
      const el = cells[i];
      const coords = getCellCoordinates(el);
      if (!coords) continue;
      const rowIndex = coords.rowIndex;
      const globalColIndex = coords.colIndex;
      const colIndex = globalColIndex - colOffset;

      // --- Active cell ---
      const wasActive = lastActive && lastActive.rowIndex === rowIndex && lastActive.columnIndex === globalColIndex;
      const isActive = activeCell && activeCell.rowIndex === rowIndex && activeCell.columnIndex === globalColIndex;

      if (wasActive && !isActive) {
        el.removeAttribute('data-active-cell');
        el.style.outline = '';
      } else if (isActive && !wasActive) {
        el.setAttribute('data-active-cell', 'true');
        el.style.outline = '2px solid var(--ogrid-accent, #0078d4)';
      }

      // --- Selection range (use pre-computed bounds) ---
      const wasInRange = lastSelBounds && inBounds(lastSelBounds, rowIndex, colIndex);
      const isInRange = selBounds && inBounds(selBounds, rowIndex, colIndex);

      // Active cell should NOT get the range background (Excel-like: anchor cell stays white)
      const showRange = isInRange && !isActive;
      const showedRange = wasInRange && !(lastActive && lastActive.rowIndex === rowIndex && lastActive.columnIndex === globalColIndex);
      if (showedRange && !showRange) {
        el.removeAttribute('data-in-range');
        el.style.backgroundColor = '';
      } else if (showRange && !showedRange) {
        el.setAttribute('data-in-range', 'true');
        el.style.backgroundColor = 'var(--ogrid-range-bg, rgba(33, 115, 70, 0.12))';
      }

      // --- Copy range ---
      const wasInCopy = lastCopyBounds && inBounds(lastCopyBounds, rowIndex, colIndex);
      const isInCopy = copyBounds && inBounds(copyBounds, rowIndex, colIndex);

      if (wasInCopy && !isInCopy) {
        // Only clear outline if not being set by another range (active/cut)
        if (!isActive && !(cutBounds && inBounds(cutBounds, rowIndex, colIndex))) {
          el.style.outline = '';
        }
      } else if (isInCopy && !wasInCopy) {
        el.style.outline = '1px dashed var(--ogrid-fg-muted, rgba(0, 0, 0, 0.5))';
      }

      // --- Cut range ---
      const wasInCut = lastCutBounds && inBounds(lastCutBounds, rowIndex, colIndex);
      const isInCut = cutBounds && inBounds(cutBounds, rowIndex, colIndex);

      if (wasInCut && !isInCut) {
        if (!isActive && !(copyBounds && inBounds(copyBounds, rowIndex, colIndex))) {
          el.style.outline = '';
        }
      } else if (isInCut && !wasInCut) {
        el.style.outline = '1px dashed var(--ogrid-accent, #0078d4)';
      }

      // --- Fill handle ---
      // Remove old fill handle if it was on a cell no longer at the bottom-right of selection
      const oldFill = el.querySelector('.ogrid-fill-handle');
      const shouldHaveFill = selectionRange && is.onFillHandleMouseDown &&
        rowIndex === Math.max(selectionRange.startRow, selectionRange.endRow) &&
        colIndex === Math.max(selectionRange.startCol, selectionRange.endCol);
      const hadFill = !!oldFill;

      if (hadFill && !shouldHaveFill) {
        oldFill?.remove();
      } else if (!hadFill && shouldHaveFill) {
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
        el.style.position = el.style.position || 'relative';
        fillHandle.addEventListener('pointerdown', (e) => {
          this.interactionState?.onFillHandleMouseDown?.(e);
        });
        el.appendChild(fillHandle);
      }

      // Restore pinned cell background if needed (selection removal may have cleared it)
      if (!isInRange && is.pinnedColumns) {
        const columnId = el.getAttribute('data-column-id');
        if (columnId && is.pinnedColumns[columnId]) {
          el.style.backgroundColor = el.style.backgroundColor || 'var(--ogrid-bg, #fff)';
        }
      }
    }

    this.snapshotState();
  }

  /** Re-render body rows and header (after sort/filter/page change). */
  update(): void {
    if (!this.tbody || !this.thead) {
      this.render();
      this.snapshotState();
      return;
    }

    // Check if only selection-related state changed — if so, patch CSS only
    if (this.isSelectionOnlyChange()) {
      this.patchSelectionClasses();
      return;
    }

    // Check if header needs rebuild
    const currentHeaderSig = this.computeHeaderSignature();
    if (currentHeaderSig !== this.lastHeaderSignature) {
      this.thead.innerHTML = '';
      this.renderHeader();
    }

    // Delegation listeners are on tbody itself — just clear inner HTML, keep listeners
    this.tbody.innerHTML = '';
    this.renderBody();

    this.snapshotState();
  }

  private hasCheckboxColumn(): boolean {
    const mode = this.interactionState?.rowSelectionMode;
    return mode === 'single' || mode === 'multiple';
  }

  private hasRowNumbersColumn(): boolean {
    return !!this.interactionState?.showRowNumbers;
  }

  /** The column index offset for data columns (checkbox + row numbers if present). */
  getColOffset(): number {
    let offset = 0;
    if (this.hasCheckboxColumn()) offset++;
    if (this.hasRowNumbersColumn()) offset++;
    return offset;
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
      el.style.backgroundColor = el.style.backgroundColor || 'var(--ogrid-bg, #fff)';
    }
  }

  private renderHeader(): void {
    if (!this.thead) return;
    this.thead.innerHTML = '';

    const visibleCols = this.state.visibleColumnDefs;
    const hasCheckbox = this.hasCheckboxColumn();
    const hasRowNumbers = this.hasRowNumbersColumn();

    // Column letter row (A, B, C...) — prepended before normal header rows
    if (this.interactionState?.showColumnLetters) {
      const letterTr = document.createElement('tr');
      letterTr.className = 'ogrid-column-letter-row';

      // Empty gutter cells for checkbox and row number columns
      if (hasCheckbox) {
        const th = document.createElement('th');
        th.className = 'ogrid-column-letter-cell';
        th.style.width = `${CHECKBOX_COLUMN_WIDTH}px`;
        letterTr.appendChild(th);
      }
      if (hasRowNumbers) {
        const th = document.createElement('th');
        th.className = 'ogrid-column-letter-cell';
        const rnw = this.interactionState?.columnWidths[ROW_NUMBER_COLUMN_ID] ?? ROW_NUMBER_COLUMN_WIDTH;
        th.style.width = `${rnw}px`;
        letterTr.appendChild(th);
      }

      // One letter cell per visible column
      for (let colIdx = 0; colIdx < visibleCols.length; colIdx++) {
        const th = document.createElement('th');
        th.className = 'ogrid-column-letter-cell';
        th.textContent = indexToColumnLetter(colIdx);
        letterTr.appendChild(th);
      }

      this.thead.appendChild(letterTr);
    }

    // buildHeaderRows expects core column types - cast through unknown
    const headerRows = buildHeaderRows(this.state.allColumns as unknown as Parameters<typeof buildHeaderRows>[0], this.state.visibleColumns);

    // If we have grouped headers (more than 1 row), render all rows
    if (headerRows.length > 1) {
      for (let rowIdx = 0; rowIdx < headerRows.length; rowIdx++) {
        const row = headerRows[rowIdx];
        const isLastRow = rowIdx === headerRows.length - 1;
        const tr = document.createElement('tr');
        if (hasCheckbox) {
          const th = document.createElement('th');
          th.className = 'ogrid-header-cell ogrid-checkbox-header';
          th.style.width = `${CHECKBOX_COLUMN_WIDTH}px`;
          // Select-all checkbox only on last header row
          if (isLastRow) {
            this.appendSelectAllCheckbox(th);
          }
          tr.appendChild(th);
        }
        if (hasRowNumbers) {
          if (isLastRow) {
            const rnw = this.interactionState?.columnWidths[ROW_NUMBER_COLUMN_ID] ?? ROW_NUMBER_COLUMN_WIDTH;
            const th = document.createElement('th');
            th.className = 'ogrid-header-cell ogrid-row-number-header';
            th.style.width = `${rnw}px`;
            th.style.minWidth = `${rnw}px`;
            th.style.maxWidth = `${rnw}px`;
            th.style.textAlign = 'center';
            th.style.position = th.style.position || 'relative';
            th.textContent = '#';
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
            resizeHandle.setAttribute('data-column-id', ROW_NUMBER_COLUMN_ID);
            th.appendChild(resizeHandle);
            tr.appendChild(th);
          } else if (rowIdx === 0) {
            // First non-last row: spacer with rowSpan covering all rows except the last
            const th = document.createElement('th');
            th.rowSpan = headerRows.length - 1;
            th.style.padding = '0';
            tr.appendChild(th);
          }
          // Middle rows (rowIdx > 0 && !isLastRow): no cell needed — covered by rowSpan from first row
        }
        for (const cell of row) {
          const th = document.createElement('th');
          th.textContent = cell.label;
          th.className = cell.isGroup ? 'ogrid-group-header' : 'ogrid-header-cell';
          if (cell.colSpan > 1) th.colSpan = cell.colSpan;

          if (!cell.isGroup && cell.columnDef?.sortable) {
            th.classList.add('ogrid-sortable');
            // Sort click also inline for compatibility with tests that hold stale <th> references
            th.addEventListener('click', () => {
              if (cell.columnDef) this.state.toggleSort(cell.columnDef.columnId);
            });
          }

          if (!cell.isGroup && cell.columnDef) {
            th.setAttribute('data-column-id', cell.columnDef.columnId);
            th.setAttribute('scope', 'col');
            const groupSort = this.state.sort;
            if (groupSort?.field === cell.columnDef.columnId) {
              th.setAttribute('aria-sort', groupSort.direction === 'asc' ? 'ascending' : 'descending');
            }
            this.applyPinningStyles(th, cell.columnDef.columnId, true);
            // Resize, reorder, and filter icon clicks are handled
            // via delegated listeners on <thead> (attachHeaderDelegation).
          }

          tr.appendChild(th);
        }
        this.thead?.appendChild(tr);
      }
    } else {
      // Single row header
      const tr = document.createElement('tr');

      // Checkbox header
      if (hasCheckbox) {
        const th = document.createElement('th');
        th.className = 'ogrid-header-cell ogrid-checkbox-header';
        th.style.width = `${CHECKBOX_COLUMN_WIDTH}px`;
        this.appendSelectAllCheckbox(th);
        tr.appendChild(th);
      }

      // Row numbers header
      if (this.hasRowNumbersColumn()) {
        const rnw = this.interactionState?.columnWidths[ROW_NUMBER_COLUMN_ID] ?? ROW_NUMBER_COLUMN_WIDTH;
        const th = document.createElement('th');
        th.className = 'ogrid-header-cell ogrid-row-number-header';
        th.style.width = `${rnw}px`;
        th.style.minWidth = `${rnw}px`;
        th.style.maxWidth = `${rnw}px`;
        th.style.textAlign = 'center';
        th.style.position = th.style.position || 'relative';
        th.textContent = '#';
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
        resizeHandle.setAttribute('data-column-id', ROW_NUMBER_COLUMN_ID);
        th.appendChild(resizeHandle);
        tr.appendChild(th);
      }

      for (let colIdx = 0; colIdx < visibleCols.length; colIdx++) {
        const col = visibleCols[colIdx];
        const th = document.createElement('th');
        th.className = 'ogrid-header-cell';
        th.setAttribute('data-column-id', col.columnId);
        th.setAttribute('scope', 'col');

        // aria-sort
        const sort = this.state.sort;
        if (sort?.field === col.columnId) {
          th.setAttribute('aria-sort', sort.direction === 'asc' ? 'ascending' : 'descending');
        }

        // Text container
        const textSpan = document.createElement('span');
        textSpan.textContent = col.name;
        th.appendChild(textSpan);

        if (col.sortable) {
          th.classList.add('ogrid-sortable');
          // Sort click also inline for compatibility with tests that hold stale <th> references
          th.addEventListener('click', () => this.state.toggleSort(col.columnId));
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

        // Resize pointerdown handled via delegated listener on <thead>

        // Filter icon (if column is filterable)
        const filterConfig = this.filterConfigs.get(col.columnId);
        if (filterConfig && this.onFilterIconClick) {
          const filterBtn = document.createElement('button');
          filterBtn.className = 'ogrid-filter-icon';
          filterBtn.setAttribute('aria-label', `Filter ${col.name}`);
          filterBtn.setAttribute('aria-expanded', 'false');
          filterBtn.setAttribute('aria-haspopup', 'dialog');
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

        // Column reorder pointerdown handled via delegated listener on <thead>

        tr.appendChild(th);
      }
      this.thead?.appendChild(tr);
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
    const hasRowNumbers = this.hasRowNumbersColumn();
    const colOffset = this.getColOffset();
    const totalColSpan = visibleCols.length + colOffset;

    // Calculate row number offset for pagination
    const rowNumberOffset = hasRowNumbers ? (this.state.page - 1) * this.state.pageSize : 0;

    if (items.length === 0 && !this.state.isLoading) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = totalColSpan;
      td.className = 'ogrid-empty-state';
      td.textContent = 'No data';
      tr.appendChild(td);
      this.tbody.appendChild(tr);
      return;
    }

    // Virtual scrolling: determine which rows to render
    const vs = this.virtualScrollState;
    const isVirtual = vs?.enabled === true;
    let startIndex = 0;
    let endIndex = items.length - 1;

    if (isVirtual) {
      const range = vs?.visibleRange;
      if (!range) return;
      startIndex = Math.max(0, range.startIndex);
      endIndex = Math.min(items.length - 1, range.endIndex);

      // Top spacer row
      if (range.offsetTop > 0) {
        const topSpacer = document.createElement('tr');
        topSpacer.className = 'ogrid-virtual-spacer';
        const topTd = document.createElement('td');
        topTd.colSpan = totalColSpan;
        topTd.style.height = `${range.offsetTop}px`;
        topTd.style.padding = '0';
        topTd.style.border = 'none';
        topSpacer.appendChild(topTd);
        this.tbody.appendChild(topSpacer);
      }
    }

    // Column virtualization: partition columns (computed once before the row loop)
    const colVirtActive = vs?.columnVirtualizationEnabled === true && vs.columnRange != null;
    let renderCols = visibleCols;
    let colGlobalIndexMap: number[] | null = null;
    let colLeftSpacerWidth = 0;
    let colRightSpacerWidth = 0;

    if (colVirtActive && vs) {
      const partition = partitionColumnsForVirtualization(
        visibleCols as unknown as Parameters<typeof partitionColumnsForVirtualization>[0],
        vs.columnRange,
        this.interactionState?.pinnedColumns,
      );
      const combined = [...partition.pinnedLeft, ...partition.virtualizedUnpinned, ...partition.pinnedRight] as unknown as typeof visibleCols;
      colGlobalIndexMap = combined.map(c => visibleCols.indexOf(c));
      renderCols = combined;
      colLeftSpacerWidth = partition.leftSpacerWidth;
      colRightSpacerWidth = partition.rightSpacerWidth;
    }

    for (let rowIndex = startIndex; rowIndex <= endIndex; rowIndex++) {
      const item = items[rowIndex];
      if (!item) continue;
      const rowId = this.state.getRowId(item);
      const tr = document.createElement('tr');
      tr.className = 'ogrid-row';
      tr.setAttribute('data-row-id', String(rowId));

      // Row selection state
      const isRowSelected = this.interactionState?.selectedRowIds?.has(rowId) === true;
      if (isRowSelected) {
        tr.setAttribute('data-row-selected', 'true');
        tr.setAttribute('aria-selected', 'true');
      }

      // Checkbox column
      if (hasCheckbox) {
        const td = document.createElement('td');
        td.className = 'ogrid-cell ogrid-checkbox-cell';
        td.style.width = `${CHECKBOX_COLUMN_WIDTH}px`;
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

      // Row numbers column
      if (hasRowNumbers) {
        const rnw = this.interactionState?.columnWidths[ROW_NUMBER_COLUMN_ID] ?? ROW_NUMBER_COLUMN_WIDTH;
        const td = document.createElement('td');
        td.className = 'ogrid-cell ogrid-row-number-cell';
        td.style.width = `${rnw}px`;
        td.style.minWidth = `${rnw}px`;
        td.style.maxWidth = `${rnw}px`;
        td.style.textAlign = 'center';
        td.style.color = 'var(--ogrid-fg-muted, #666)';
        td.style.fontSize = '0.9em';
        td.textContent = String(rowNumberOffset + rowIndex + 1);
        tr.appendChild(td);
      }

      // Left column spacer
      if (colLeftSpacerWidth > 0) {
        const spacerTd = document.createElement('td');
        spacerTd.style.width = `${colLeftSpacerWidth}px`;
        spacerTd.style.minWidth = `${colLeftSpacerWidth}px`;
        spacerTd.style.padding = '0';
        spacerTd.style.border = 'none';
        spacerTd.setAttribute('aria-hidden', 'true');
        tr.appendChild(spacerTd);
      }

      for (let colIndex = 0; colIndex < renderCols.length; colIndex++) {
        const col = renderCols[colIndex];
        const globalColIndex = (colGlobalIndexMap ? colGlobalIndexMap[colIndex] : colIndex) + colOffset;
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
            td.style.outline = '2px solid var(--ogrid-accent, #0078d4)';
          }

          // Selection range
          if (selectionRange && isInSelectionRange(selectionRange, rowIndex, colIndex)) {
            td.setAttribute('data-in-range', 'true');
            td.style.backgroundColor = 'var(--ogrid-range-bg, rgba(33, 115, 70, 0.12))';
          }

          // Copy range
          if (copyRange && isInSelectionRange(copyRange, rowIndex, colIndex)) {
            td.style.outline = '1px dashed var(--ogrid-fg-muted, rgba(0, 0, 0, 0.5))';
          }

          // Cut range
          if (cutRange && isInSelectionRange(cutRange, rowIndex, colIndex)) {
            td.style.outline = '1px dashed var(--ogrid-accent, #0078d4)';
          }

          // Editing cell (hide content, editor overlay will be shown)
          if (editingCell && editingCell.rowId === rowId && editingCell.columnId === col.columnId) {
            td.style.visibility = 'hidden';
          }

          // Cell interaction is handled by delegated listeners on tbody

        }

        // Custom DOM render
        if (col.renderCell) {
          // Cast col to unknown first to work around structural differences
          const rawValue = getCellValue(item, col as unknown as Parameters<typeof getCellValue>[1]);
          // Use formula result if available
          const value = this.formulaEngine?.isEnabled() && this.formulaEngine.hasFormula(colIndex, rowIndex)
            ? (this.formulaEngine.getValue(colIndex, rowIndex) ?? rawValue)
            : rawValue;
          col.renderCell(td, item, value);
        } else {
          // Default: text content via valueFormatter or toString
          const rawValue = getCellValue(item, col as unknown as Parameters<typeof getCellValue>[1]);
          // Use formula result if available
          const value = this.formulaEngine?.isEnabled() && this.formulaEngine.hasFormula(colIndex, rowIndex)
            ? (this.formulaEngine.getValue(colIndex, rowIndex) ?? rawValue)
            : rawValue;
          if (col.type === 'boolean') {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = Boolean(value);
            checkbox.disabled = true;
            checkbox.style.margin = '0';
            checkbox.style.pointerEvents = 'none';
            checkbox.setAttribute('aria-label', value ? 'True' : 'False');
            td.appendChild(checkbox);
          } else if (col.valueFormatter) {
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

            // Fill handle pointerdown handled via delegated listener on <tbody>
            td.appendChild(fillHandle);
          }
        }

        tr.appendChild(td);
      }

      // Right column spacer
      if (colRightSpacerWidth > 0) {
        const spacerTd = document.createElement('td');
        spacerTd.style.width = `${colRightSpacerWidth}px`;
        spacerTd.style.minWidth = `${colRightSpacerWidth}px`;
        spacerTd.style.padding = '0';
        spacerTd.style.border = 'none';
        spacerTd.setAttribute('aria-hidden', 'true');
        tr.appendChild(spacerTd);
      }

      this.tbody.appendChild(tr);
    }

    // Virtual scrolling: bottom spacer row
    if (isVirtual && vs) {
      const range = vs.visibleRange;
      if (range.offsetBottom > 0) {
        const bottomSpacer = document.createElement('tr');
        bottomSpacer.className = 'ogrid-virtual-spacer';
        const bottomTd = document.createElement('td');
        bottomTd.colSpan = totalColSpan;
        bottomTd.style.height = `${range.offsetBottom}px`;
        bottomTd.style.padding = '0';
        bottomTd.style.border = 'none';
        bottomSpacer.appendChild(bottomTd);
        this.tbody.appendChild(bottomSpacer);
      }
    }
  }

  /** Get the table element (used by ColumnReorderState for header cell queries). */
  getTableElement(): HTMLTableElement | null {
    return this.table;
  }

  /** Get the current onResizeStart handler from interaction state (avoids bracket notation access). */
  getOnResizeStart(): ((columnId: string, clientX: number, currentWidth: number) => void) | undefined {
    return this.interactionState?.onResizeStart;
  }

  /** Update the drop indicator position during column reorder. */
  updateDropIndicator(x: number | null, isDragging: boolean): void {
    if (!this.dropIndicator || !this.wrapperEl) return;

    if (!isDragging || x === null) {
      this.dropIndicator.style.display = 'none';
      return;
    }

    // Convert client X to position relative to the wrapper
    const wrapperRect = this.wrapperEl.getBoundingClientRect();
    const relativeX = x - wrapperRect.left + this.wrapperEl.scrollLeft;

    this.dropIndicator.style.display = 'block';
    this.dropIndicator.style.left = `${relativeX}px`;
  }

  destroy(): void {
    this.detachHeaderDelegation();
    this.detachBodyDelegation();
    this.container.innerHTML = '';
    this.table = null;
    this.thead = null;
    this.tbody = null;
    this.dropIndicator = null;
  }
}
