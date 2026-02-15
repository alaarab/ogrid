import { signal, computed, ElementRef, Input } from '@angular/core';
import type { ColumnFilterType, IDateFilterValue, UserLike } from '../types';

export interface IColumnHeaderFilterProps {
  columnKey: string;
  columnName: string;
  filterType: ColumnFilterType;
  isSorted?: boolean;
  isSortedDescending?: boolean;
  onSort?: () => void;
  selectedValues?: string[];
  onFilterChange?: (values: string[]) => void;
  options?: string[];
  isLoadingOptions?: boolean;
  textValue?: string;
  onTextChange?: (value: string) => void;
  selectedUser?: UserLike;
  onUserChange?: (user: UserLike | undefined) => void;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
  dateValue?: IDateFilterValue;
  onDateChange?: (value: IDateFilterValue | undefined) => void;
}

/**
 * Abstract base class containing all shared TypeScript logic for ColumnHeaderFilter components.
 * Framework-specific UI packages extend this with their templates and style overrides.
 *
 * Subclasses must:
 * 1. Provide a @Component decorator with template and styles
 * 2. Implement abstract accessor for headerEl (ViewChild reference)
 */
export abstract class BaseColumnHeaderFilterComponent {
  @Input({ required: true }) columnKey!: string;
  @Input({ required: true }) columnName!: string;

  // Signal-backed inputs used by computed() — plain @Input properties aren't tracked by computed()
  private readonly _filterType = signal<ColumnFilterType>('none');
  private readonly _selectedValues = signal<string[] | undefined>(undefined);
  private readonly _options = signal<string[] | undefined>(undefined);
  private readonly _textValue = signal('');
  private readonly _selectedUser = signal<UserLike | undefined>(undefined);
  private readonly _dateValue = signal<IDateFilterValue | undefined>(undefined);

  @Input({ required: true })
  set filterType(v: ColumnFilterType) { this._filterType.set(v); }
  get filterType(): ColumnFilterType { return this._filterType(); }

  @Input()
  set selectedValues(v: string[] | undefined) { this._selectedValues.set(v); }
  get selectedValues(): string[] | undefined { return this._selectedValues(); }

  @Input()
  set options(v: string[] | undefined) { this._options.set(v); }
  get options(): string[] | undefined { return this._options(); }

  @Input()
  set textValue(v: string) { this._textValue.set(v); }
  get textValue(): string { return this._textValue(); }

  @Input()
  set selectedUser(v: UserLike | undefined) { this._selectedUser.set(v); }
  get selectedUser(): UserLike | undefined { return this._selectedUser(); }

  @Input()
  set dateValue(v: IDateFilterValue | undefined) { this._dateValue.set(v); }
  get dateValue(): IDateFilterValue | undefined { return this._dateValue(); }

  // Plain inputs (not used in computed() — no signal wrapper needed)
  @Input() isSorted: boolean = false;
  @Input() isSortedDescending: boolean = false;
  @Input() onSort: (() => void) | undefined = undefined;
  @Input() onFilterChange: ((values: string[]) => void) | undefined = undefined;
  @Input() isLoadingOptions: boolean = false;
  @Input() onTextChange: ((value: string) => void) | undefined = undefined;
  @Input() onUserChange: ((user: UserLike | undefined) => void) | undefined = undefined;
  @Input() peopleSearch: ((query: string) => Promise<UserLike[]>) | undefined = undefined;
  @Input() onDateChange: ((value: IDateFilterValue | undefined) => void) | undefined = undefined;

  // Abstract accessor for subclass-provided element ref
  protected abstract getHeaderEl(): ElementRef<HTMLElement> | undefined;

  // Internal state signals
  readonly isFilterOpen = signal(false);
  readonly tempTextValue = signal('');
  readonly searchText = signal('');
  readonly tempSelected = signal<Set<string>>(new Set());
  readonly peopleSearchText = signal('');
  readonly peopleSuggestions = signal<UserLike[]>([]);
  readonly isPeopleLoading = signal(false);
  readonly tempDateFrom = signal('');
  readonly tempDateTo = signal('');

  // Popover position
  readonly popoverTop = signal(0);
  readonly popoverLeft = signal(0);

  private peopleDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Computed signals
  readonly hasActiveFilter = computed(() => {
    const ft = this._filterType();
    if (ft === 'text') return !!this._textValue();
    if (ft === 'multiSelect') return (this._selectedValues()?.length ?? 0) > 0;
    if (ft === 'people') return this._selectedUser() != null;
    if (ft === 'date') return this._dateValue() != null;
    return false;
  });

  readonly filteredOptions = computed(() => {
    const opts = this._options() ?? [];
    const search = this.searchText().toLowerCase().trim();
    if (!search) return opts;
    return opts.filter((o) => o.toLowerCase().includes(search));
  });

  // Utility methods
  asInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  toggleFilter(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isFilterOpen()) {
      this.isFilterOpen.set(false);
      return;
    }
    // Initialize temp state from current values
    this.tempTextValue.set(this.textValue);
    this.tempSelected.set(new Set(this.selectedValues ?? []));
    this.searchText.set('');
    this.peopleSearchText.set('');
    this.peopleSuggestions.set([]);
    const dv = this.dateValue;
    this.tempDateFrom.set(dv?.from ?? '');
    this.tempDateTo.set(dv?.to ?? '');

    // Compute popover position
    const el = this.getHeaderEl()?.nativeElement;
    if (el) {
      const rect = el.getBoundingClientRect();
      this.popoverTop.set(rect.bottom + 4);
      this.popoverLeft.set(rect.left);
    }
    this.isFilterOpen.set(true);
  }

  // --- Text filter handlers ---
  onTextKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      this.handleTextApply();
    }
  }

  handleTextApply(): void {
    this.onTextChange!(this.tempTextValue());
    this.isFilterOpen.set(false);
  }

  handleTextClear(): void {
    this.tempTextValue.set('');
    this.onTextChange!('');
    this.isFilterOpen.set(false);
  }

  // --- MultiSelect filter handlers ---
  handleCheckboxChange(option: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.tempSelected.update((s) => {
      const next = new Set(s);
      if (checked) next.add(option);
      else next.delete(option);
      return next;
    });
  }

  handleSelectAllFiltered(): void {
    this.tempSelected.update((s) => {
      const next = new Set(s);
      for (const opt of this.filteredOptions()) next.add(opt);
      return next;
    });
  }

  handleClearSelection(): void {
    this.tempSelected.set(new Set());
  }

  handleApplyMultiSelect(): void {
    this.onFilterChange!(Array.from(this.tempSelected()));
    this.isFilterOpen.set(false);
  }

  // --- People filter handlers ---
  onPeopleSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.peopleSearchText.set(value);
    if (this.peopleDebounceTimer) clearTimeout(this.peopleDebounceTimer);
    const query = value.trim();
    if (!query) {
      this.peopleSuggestions.set([]);
      this.isPeopleLoading.set(false);
      return;
    }
    this.isPeopleLoading.set(true);
    this.peopleDebounceTimer = setTimeout(() => {
      const fn = this.peopleSearch;
      if (!fn) return;
      fn(query)
        .then((results) => {
          this.peopleSuggestions.set(results);
          this.isPeopleLoading.set(false);
        })
        .catch(() => {
          this.peopleSuggestions.set([]);
          this.isPeopleLoading.set(false);
        });
    }, 300);
  }

  handleUserSelect(user: UserLike): void {
    this.onUserChange!(user);
    this.isFilterOpen.set(false);
  }

  handleClearUser(): void {
    this.onUserChange!(undefined);
    this.isFilterOpen.set(false);
  }

  // --- Date filter handlers ---
  handleDateApply(): void {
    const from = this.tempDateFrom();
    const to = this.tempDateTo();
    if (!from && !to) {
      this.onDateChange!(undefined);
    } else {
      this.onDateChange!({ from: from || undefined, to: to || undefined });
    }
    this.isFilterOpen.set(false);
  }

  handleDateClear(): void {
    this.tempDateFrom.set('');
    this.tempDateTo.set('');
    this.onDateChange!(undefined);
    this.isFilterOpen.set(false);
  }

  // --- Document click handler (for click-outside to close) ---
  onDocumentClick(event: MouseEvent, selectorName: string): void {
    const el = event.target as HTMLElement;
    if (!el.closest(selectorName) && !el.closest('.ogrid-header-filter__popover')) {
      this.isFilterOpen.set(false);
    }
  }
}
