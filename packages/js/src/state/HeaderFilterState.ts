import type { IFilters, FilterValue } from '@alaarab/ogrid-core';
import type { ColumnFilterType, IDateFilterValue } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

export interface HeaderFilterConfig {
  columnId: string;
  filterField: string;
  filterType: ColumnFilterType;
}

/**
 * Manages header filter popover state for all columns.
 * Equivalent of React's useColumnHeaderFilterState, but class-based.
 */
export class HeaderFilterState {
  private emitter = new EventEmitter<{ change: undefined }>();

  // Which column's filter is currently open (null = none)
  private _openColumnId: string | null = null;

  // Temporary state for the currently open filter popover
  private _tempTextValue = '';
  private _tempSelected = new Set<string>();
  private _tempDateFrom = '';
  private _tempDateTo = '';
  private _searchText = '';

  // Popover position
  private _popoverPosition: { top: number; left: number } | null = null;

  // External references
  private _filters: IFilters = {};
  private _onFilterChange: (key: string, value: FilterValue | undefined) => void;
  private _filterOptions: Record<string, string[]> = {};

  // Click-outside handler
  private _clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
  private _escapeHandler: ((e: KeyboardEvent) => void) | null = null;
  private _popoverEl: HTMLElement | null = null;
  private _headerEl: HTMLElement | null = null;

  constructor(onFilterChange: (key: string, value: FilterValue | undefined) => void) {
    this._onFilterChange = onFilterChange;
  }

  get openColumnId(): string | null { return this._openColumnId; }
  get tempTextValue(): string { return this._tempTextValue; }
  get tempSelected(): Set<string> { return this._tempSelected; }
  get tempDateFrom(): string { return this._tempDateFrom; }
  get tempDateTo(): string { return this._tempDateTo; }
  get searchText(): string { return this._searchText; }
  get popoverPosition(): { top: number; left: number } | null { return this._popoverPosition; }

  setFilters(filters: IFilters): void {
    this._filters = filters;
  }

  setFilterOptions(options: Record<string, string[]>): void {
    this._filterOptions = options;
  }

  /** Allow OGrid to update the popover element reference after rendering (for click-outside detection). */
  setPopoverEl(el: HTMLElement | null): void {
    this._popoverEl = el;
  }

  getFilterOptions(filterField: string): string[] {
    return this._filterOptions[filterField] ?? [];
  }

  getFilteredOptions(filterField: string): string[] {
    const options = this.getFilterOptions(filterField);
    if (!this._searchText) return options;
    const lower = this._searchText.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(lower));
  }

  hasActiveFilter(config: HeaderFilterConfig): boolean {
    const fv = this._filters[config.filterField];
    if (!fv) return false;
    if (fv.type === 'text') return fv.value.trim().length > 0;
    if (fv.type === 'multiSelect') return fv.value.length > 0;
    if (fv.type === 'date') return !!(fv.value.from || fv.value.to);
    if (fv.type === 'people') return !!fv.value;
    return false;
  }

  /**
   * Open a filter popover for a specific column.
   */
  open(columnId: string, config: HeaderFilterConfig, headerEl: HTMLElement, popoverEl: HTMLElement): void {
    // Close any existing popover first
    if (this._openColumnId) {
      this.close();
    }

    this._openColumnId = columnId;
    this._headerEl = headerEl;
    this._popoverEl = popoverEl;

    // Initialize temp state from current filter values
    const fv = this._filters[config.filterField];
    if (config.filterType === 'text') {
      this._tempTextValue = fv?.type === 'text' ? fv.value : '';
    } else if (config.filterType === 'multiSelect') {
      this._tempSelected = new Set(fv?.type === 'multiSelect' ? fv.value : []);
    } else if (config.filterType === 'date') {
      const dv = fv?.type === 'date' ? fv.value : {} as IDateFilterValue;
      this._tempDateFrom = dv.from ?? '';
      this._tempDateTo = dv.to ?? '';
    }
    this._searchText = '';

    // Compute position
    const rect = headerEl.getBoundingClientRect();
    this._popoverPosition = { top: rect.bottom + 4, left: rect.left };

    // Set up click-outside listener
    this._clickOutsideHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        this._popoverEl && !this._popoverEl.contains(target) &&
        this._headerEl && !this._headerEl.contains(target)
      ) {
        this.close();
      }
    };
    this._escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    };
    setTimeout(() => {
      if (this._clickOutsideHandler) {
        document.addEventListener('mousedown', this._clickOutsideHandler, { passive: true });
      }
    }, 0);
    if (this._escapeHandler) {
      document.addEventListener('keydown', this._escapeHandler, true);
    }

    this.emitter.emit('change');
  }

  close(): void {
    this._openColumnId = null;
    this._popoverPosition = null;
    this._popoverEl = null;
    this._headerEl = null;

    if (this._clickOutsideHandler) {
      document.removeEventListener('mousedown', this._clickOutsideHandler);
      this._clickOutsideHandler = null;
    }
    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler, true);
      this._escapeHandler = null;
    }

    this.emitter.emit('change');
  }

  // --- Temp state setters ---

  setTempTextValue(v: string): void {
    this._tempTextValue = v;
    this.emitter.emit('change');
  }

  setSearchText(v: string): void {
    this._searchText = v;
    this.emitter.emit('change');
  }

  setTempDateFrom(v: string): void {
    this._tempDateFrom = v;
    this.emitter.emit('change');
  }

  setTempDateTo(v: string): void {
    this._tempDateTo = v;
    this.emitter.emit('change');
  }

  // --- Checkbox handlers ---

  handleCheckboxChange(option: string, checked: boolean): void {
    const next = new Set(this._tempSelected);
    if (checked) next.add(option);
    else next.delete(option);
    this._tempSelected = next;
    this.emitter.emit('change');
  }

  handleSelectAll(filterField: string): void {
    this._tempSelected = new Set(this.getFilterOptions(filterField));
    this.emitter.emit('change');
  }

  handleClearSelection(): void {
    this._tempSelected = new Set();
    this.emitter.emit('change');
  }

  // --- Apply/Clear ---

  applyTextFilter(filterField: string): void {
    const value = this._tempTextValue.trim();
    this._onFilterChange(filterField, value ? { type: 'text', value } : undefined);
    this.close();
  }

  clearTextFilter(filterField: string): void {
    this._tempTextValue = '';
    this._onFilterChange(filterField, undefined);
    this.close();
  }

  applyMultiSelectFilter(filterField: string): void {
    const arr = Array.from(this._tempSelected);
    this._onFilterChange(filterField, arr.length > 0 ? { type: 'multiSelect', value: arr } : undefined);
    this.close();
  }

  applyDateFilter(filterField: string): void {
    const from = this._tempDateFrom || undefined;
    const to = this._tempDateTo || undefined;
    this._onFilterChange(filterField, from || to ? { type: 'date', value: { from, to } } : undefined);
    this.close();
  }

  clearDateFilter(filterField: string): void {
    this._tempDateFrom = '';
    this._tempDateTo = '';
    this._onFilterChange(filterField, undefined);
    this.close();
  }

  clearFilter(filterField: string): void {
    this._onFilterChange(filterField, undefined);
    this.close();
  }

  onChange(handler: () => void): () => void {
    this.emitter.on('change', handler);
    return () => this.emitter.off('change', handler);
  }

  destroy(): void {
    this.close();
    this.emitter.removeAllListeners();
  }
}
