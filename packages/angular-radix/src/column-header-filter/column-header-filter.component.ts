import {
  Component, input, signal, computed,
  ChangeDetectionStrategy, ElementRef, viewChild,
} from '@angular/core';
import type { ColumnFilterType, IDateFilterValue, UserLike } from '@alaarab/ogrid-angular';

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
 * Column header filter component for Angular Radix (lightweight styling).
 * Standalone component with inline template and positioned popovers.
 */
@Component({
  selector: 'column-header-filter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ogrid-header-filter" #headerEl>
      <div class="ogrid-header-filter__label">
        <span class="ogrid-header-filter__name" [title]="columnName()" data-header-label>
          {{ columnName() }}
        </span>
      </div>

      <div class="ogrid-header-filter__actions">
        @if (onSort()) {
          <button
            class="ogrid-header-filter__btn"
            [class.ogrid-header-filter__btn--active]="isSorted()"
            (click)="onSort()!()"
            [attr.aria-label]="'Sort by ' + columnName()"
            [title]="isSorted() ? (isSortedDescending() ? 'Sorted descending' : 'Sorted ascending') : 'Sort'"
          >
            @if (isSorted() && isSortedDescending()) {
              ▼
            } @else if (isSorted()) {
              ▲
            } @else {
              ↕
            }
          </button>
        }

        @if (filterType() !== 'none') {
          <button
            class="ogrid-header-filter__btn"
            [class.ogrid-header-filter__btn--active]="hasActiveFilter() || isFilterOpen()"
            (click)="toggleFilter($event)"
            [attr.aria-label]="'Filter ' + columnName()"
            [title]="'Filter ' + columnName()"
          >
            ⏷
            @if (hasActiveFilter()) {
              <span class="ogrid-header-filter__dot"></span>
            }
          </button>
        }
      </div>
    </div>

    @if (isFilterOpen() && filterType() !== 'none') {
      <div
        class="ogrid-header-filter__popover"
        [style.top.px]="popoverTop()"
        [style.left.px]="popoverLeft()"
        (click)="$event.stopPropagation()"
      >
        <div class="ogrid-header-filter__popover-header">
          Filter: {{ columnName() }}
        </div>

        @switch (filterType()) {
          @case ('text') {
            <div class="ogrid-header-filter__popover-body" style="width: 260px;">
              <div style="padding: 12px;">
                <input
                  type="text"
                  class="ogrid-header-filter__input"
                  placeholder="Enter search term..."
                  [value]="tempTextValue()"
                  (input)="tempTextValue.set(asInputValue($event))"
                  (keydown)="onTextKeydown($event)"
                  autocomplete="off"
                />
              </div>
              <div class="ogrid-header-filter__popover-actions">
                <button class="ogrid-header-filter__action-btn" [disabled]="!tempTextValue()" (click)="handleTextClear()">Clear</button>
                <button class="ogrid-header-filter__action-btn ogrid-header-filter__action-btn--primary" (click)="handleTextApply()">Apply</button>
              </div>
            </div>
          }
          @case ('multiSelect') {
            <div class="ogrid-header-filter__popover-body" style="width: 280px;">
              <div style="padding: 12px 12px 4px;">
                <input
                  type="text"
                  class="ogrid-header-filter__input"
                  placeholder="Search..."
                  [value]="searchText()"
                  (input)="searchText.set(asInputValue($event))"
                  (keydown)="$event.stopPropagation()"
                  autocomplete="off"
                />
                <div class="ogrid-header-filter__options-info">
                  {{ filteredOptions().length }} of {{ (options() ?? []).length }} options
                </div>
              </div>
              <div class="ogrid-header-filter__select-actions">
                <button class="ogrid-header-filter__action-btn" (click)="handleSelectAllFiltered()">
                  Select All ({{ filteredOptions().length }})
                </button>
                <button class="ogrid-header-filter__action-btn" (click)="handleClearSelection()">Clear</button>
              </div>
              <div class="ogrid-header-filter__options-list">
                @if (isLoadingOptions()) {
                  <div class="ogrid-header-filter__loading">Loading...</div>
                } @else if (filteredOptions().length === 0) {
                  <div class="ogrid-header-filter__empty">No options found</div>
                } @else {
                  @for (option of filteredOptions(); track option) {
                    <label class="ogrid-header-filter__option">
                      <input
                        type="checkbox"
                        [checked]="tempSelected().has(option)"
                        (change)="handleCheckboxChange(option, $event)"
                      />
                      <span>{{ option }}</span>
                    </label>
                  }
                }
              </div>
              <div class="ogrid-header-filter__popover-actions" style="border-top: 1px solid var(--ogrid-border, #e0e0e0);">
                <button class="ogrid-header-filter__action-btn" [disabled]="tempSelected().size === 0" (click)="handleMultiSelectClear()">Clear</button>
                <button class="ogrid-header-filter__action-btn ogrid-header-filter__action-btn--primary" (click)="handleMultiSelectApply()">Apply</button>
              </div>
            </div>
          }
          @case ('people') {
            <div class="ogrid-header-filter__popover-body" style="width: 300px;">
              @if (selectedUser()) {
                <div class="ogrid-header-filter__people-selected">
                  <div class="ogrid-header-filter__people-info-label">Currently filtered by:</div>
                  <div class="ogrid-header-filter__people-card">
                    <div class="ogrid-header-filter__people-avatar">{{ selectedUser()!.displayName?.[0] ?? '?' }}</div>
                    <div class="ogrid-header-filter__people-details">
                      <div>{{ selectedUser()!.displayName }}</div>
                      <div class="ogrid-header-filter__people-email">{{ selectedUser()!.email }}</div>
                    </div>
                    <button class="ogrid-header-filter__btn" (click)="handleClearUser()" aria-label="Remove filter">&times;</button>
                  </div>
                </div>
              }
              <div style="padding: 12px 12px 4px;">
                <input
                  type="text"
                  class="ogrid-header-filter__input"
                  placeholder="Search for a person..."
                  [value]="peopleSearchText()"
                  (input)="onPeopleSearchInput($event)"
                  (keydown)="$event.stopPropagation()"
                  autocomplete="off"
                />
              </div>
              <div class="ogrid-header-filter__options-list">
                @if (isPeopleLoading() && peopleSearchText().trim()) {
                  <div class="ogrid-header-filter__loading">Loading...</div>
                } @else if (peopleSuggestions().length === 0 && peopleSearchText().trim()) {
                  <div class="ogrid-header-filter__empty">No results found</div>
                } @else if (peopleSearchText().trim()) {
                  @for (user of peopleSuggestions(); track user.id || user.email || user.displayName) {
                    <div class="ogrid-header-filter__people-option" (click)="handleUserSelect(user)">
                      <div class="ogrid-header-filter__people-avatar">{{ user.displayName?.[0] ?? '?' }}</div>
                      <div class="ogrid-header-filter__people-details">
                        <div>{{ user.displayName }}</div>
                        <div class="ogrid-header-filter__people-email">{{ user.email }}</div>
                      </div>
                    </div>
                  }
                } @else {
                  <div class="ogrid-header-filter__empty">Type to search...</div>
                }
              </div>
              @if (selectedUser()) {
                <div style="padding: 8px 12px; border-top: 1px solid var(--ogrid-border, #e0e0e0);">
                  <button class="ogrid-header-filter__action-btn" style="width: 100%;" (click)="handleClearUser()">Clear Filter</button>
                </div>
              }
            </div>
          }
          @case ('date') {
            <div class="ogrid-header-filter__popover-body" style="width: 280px;">
              <div style="padding: 12px;">
                <div style="margin-bottom: 8px;">
                  <label style="display: block; margin-bottom: 4px; font-size: 13px; font-weight: 600;">From</label>
                  <input
                    type="date"
                    class="ogrid-header-filter__input"
                    [value]="tempDateFrom()"
                    (change)="tempDateFrom.set(asInputValue($event))"
                  />
                </div>
                <div>
                  <label style="display: block; margin-bottom: 4px; font-size: 13px; font-weight: 600;">To</label>
                  <input
                    type="date"
                    class="ogrid-header-filter__input"
                    [value]="tempDateTo()"
                    (change)="tempDateTo.set(asInputValue($event))"
                  />
                </div>
              </div>
              <div class="ogrid-header-filter__popover-actions">
                <button class="ogrid-header-filter__action-btn" [disabled]="!tempDateFrom() && !tempDateTo()" (click)="handleDateClear()">Clear</button>
                <button class="ogrid-header-filter__action-btn ogrid-header-filter__action-btn--primary" (click)="handleDateApply()">Apply</button>
              </div>
            </div>
          }
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .ogrid-header-filter {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      height: 100%;
      flex: 1;
    }
    .ogrid-header-filter__label {
      flex: 1;
      min-width: 0;
    }
    .ogrid-header-filter__name {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ogrid-header-filter__actions {
      display: flex;
      gap: 2px;
      flex-shrink: 0;
    }
    .ogrid-header-filter__btn {
      position: relative;
      min-width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: 2px;
      background: transparent;
      color: var(--ogrid-fg, #242424);
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.6;
      transition: all 0.15s ease;
    }
    .ogrid-header-filter__btn:hover {
      opacity: 1;
      background: var(--ogrid-hover-bg, #f0f0f0);
    }
    .ogrid-header-filter__btn--active {
      opacity: 1;
      color: var(--ogrid-active-border, #0078d4);
      font-weight: 700;
    }
    .ogrid-header-filter__dot {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--ogrid-active-border, #0078d4);
    }
    .ogrid-header-filter__popover {
      position: fixed;
      z-index: 1000;
      background: var(--ogrid-bg, #ffffff);
      border: 1px solid var(--ogrid-border, #e0e0e0);
      border-radius: 4px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      min-width: 200px;
    }
    .ogrid-header-filter__popover-header {
      padding: 8px 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--ogrid-fg, #242424);
      border-bottom: 1px solid var(--ogrid-border, #e0e0e0);
      background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-header-filter__popover-body {
      display: flex;
      flex-direction: column;
    }
    .ogrid-header-filter__input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--ogrid-border, #e0e0e0);
      border-radius: 4px;
      font-size: 14px;
      background: var(--ogrid-bg, #ffffff);
      color: var(--ogrid-fg, #242424);
    }
    .ogrid-header-filter__input:focus {
      outline: 2px solid var(--ogrid-active-border, #0078d4);
      outline-offset: 1px;
    }
    .ogrid-header-filter__options-info {
      margin-top: 6px;
      font-size: 12px;
      color: var(--ogrid-fg, #242424);
      opacity: 0.7;
    }
    .ogrid-header-filter__select-actions {
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--ogrid-border, #e0e0e0);
    }
    .ogrid-header-filter__options-list {
      max-height: 240px;
      overflow-y: auto;
      padding: 4px 0;
    }
    .ogrid-header-filter__option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 14px;
      color: var(--ogrid-fg, #242424);
      transition: background 0.15s ease;
    }
    .ogrid-header-filter__option:hover {
      background: var(--ogrid-hover-bg, #f0f0f0);
    }
    .ogrid-header-filter__loading,
    .ogrid-header-filter__empty {
      padding: 16px;
      text-align: center;
      font-size: 14px;
      color: var(--ogrid-fg, #242424);
      opacity: 0.7;
    }
    .ogrid-header-filter__popover-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 8px 12px;
      background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-header-filter__action-btn {
      padding: 6px 12px;
      border: 1px solid var(--ogrid-border, #e0e0e0);
      border-radius: 4px;
      background: var(--ogrid-bg, #ffffff);
      color: var(--ogrid-fg, #242424);
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s ease;
    }
    .ogrid-header-filter__action-btn:hover:not(:disabled) {
      background: var(--ogrid-hover-bg, #f0f0f0);
    }
    .ogrid-header-filter__action-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .ogrid-header-filter__action-btn--primary {
      background: var(--ogrid-active-border, #0078d4);
      color: #ffffff;
      border-color: var(--ogrid-active-border, #0078d4);
    }
    .ogrid-header-filter__action-btn--primary:hover:not(:disabled) {
      opacity: 0.9;
    }
    .ogrid-header-filter__people-selected {
      padding: 12px;
      border-bottom: 1px solid var(--ogrid-border, #e0e0e0);
    }
    .ogrid-header-filter__people-info-label {
      font-size: 12px;
      color: var(--ogrid-fg, #242424);
      opacity: 0.7;
      margin-bottom: 6px;
    }
    .ogrid-header-filter__people-card {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background: var(--ogrid-header-bg, #f5f5f5);
      border-radius: 4px;
    }
    .ogrid-header-filter__people-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--ogrid-active-border, #0078d4);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .ogrid-header-filter__people-details {
      flex: 1;
      min-width: 0;
      font-size: 13px;
    }
    .ogrid-header-filter__people-email {
      font-size: 11px;
      color: var(--ogrid-fg, #242424);
      opacity: 0.6;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ogrid-header-filter__people-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .ogrid-header-filter__people-option:hover {
      background: var(--ogrid-hover-bg, #f0f0f0);
    }
  `],
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class ColumnHeaderFilterComponent {
  readonly columnKey = input.required<string>();
  readonly columnName = input.required<string>();
  readonly filterType = input.required<ColumnFilterType>();
  readonly isSorted = input<boolean>(false);
  readonly isSortedDescending = input<boolean>(false);
  readonly onSort = input<(() => void) | undefined>(undefined);
  readonly selectedValues = input<string[]>([]);
  readonly onFilterChange = input<((values: string[]) => void) | undefined>(undefined);
  readonly options = input<string[] | undefined>(undefined);
  readonly isLoadingOptions = input<boolean>(false);
  readonly textValue = input<string>('');
  readonly onTextChange = input<((value: string) => void) | undefined>(undefined);
  readonly selectedUser = input<UserLike | undefined>(undefined);
  readonly onUserChange = input<((user: UserLike | undefined) => void) | undefined>(undefined);
  readonly peopleSearch = input<((query: string) => Promise<UserLike[]>) | undefined>(undefined);
  readonly dateValue = input<IDateFilterValue | undefined>(undefined);
  readonly onDateChange = input<((value: IDateFilterValue | undefined) => void) | undefined>(undefined);

  private readonly headerRef = viewChild<ElementRef<HTMLElement>>('headerEl');

  readonly isFilterOpen = signal(false);
  readonly popoverTop = signal(0);
  readonly popoverLeft = signal(0);

  // Text filter
  readonly tempTextValue = signal('');

  // MultiSelect filter
  readonly searchText = signal('');
  readonly tempSelected = signal(new Set<string>());

  // Date filter
  readonly tempDateFrom = signal('');
  readonly tempDateTo = signal('');

  // People filter
  readonly peopleSearchText = signal('');
  readonly peopleSuggestions = signal<UserLike[]>([]);
  readonly isPeopleLoading = signal(false);
  private peopleDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly hasActiveFilter = computed(() => {
    const ft = this.filterType();
    if (ft === 'text') return !!this.textValue();
    if (ft === 'multiSelect') return (this.selectedValues() ?? []).length > 0;
    if (ft === 'people') return this.selectedUser() != null;
    if (ft === 'date') {
      const dv = this.dateValue();
      return !!dv && (!!dv.from || !!dv.to);
    }
    return false;
  });

  readonly filteredOptions = computed(() => {
    const search = this.searchText().toLowerCase();
    const opts = this.options() ?? [];
    if (!search) return opts;
    return opts.filter(o => o.toLowerCase().includes(search));
  });

  toggleFilter(event: MouseEvent): void {
    event.stopPropagation();

    if (this.isFilterOpen()) {
      this.isFilterOpen.set(false);
      return;
    }

    // Initialize temp values
    if (this.filterType() === 'text') {
      this.tempTextValue.set(this.textValue() ?? '');
    } else if (this.filterType() === 'multiSelect') {
      this.tempSelected.set(new Set(this.selectedValues() ?? []));
      this.searchText.set('');
    } else if (this.filterType() === 'people') {
      this.peopleSearchText.set('');
      this.peopleSuggestions.set([]);
      this.isPeopleLoading.set(false);
    } else if (this.filterType() === 'date') {
      const dv = this.dateValue();
      this.tempDateFrom.set(dv?.from ?? '');
      this.tempDateTo.set(dv?.to ?? '');
    }

    // Calculate popover position
    const headerEl = this.headerRef()?.nativeElement;
    if (headerEl) {
      const rect = headerEl.getBoundingClientRect();
      this.popoverTop.set(rect.bottom + 4);
      this.popoverLeft.set(rect.left);
    }

    this.isFilterOpen.set(true);
  }

  onDocumentClick(event: MouseEvent): void {
    const el = event.target as HTMLElement;
    if (!el.closest('column-header-filter')) {
      this.isFilterOpen.set(false);
    }
  }

  asInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  // Text filter handlers
  onTextKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.handleTextApply();
    } else if (event.key === 'Escape') {
      this.isFilterOpen.set(false);
    }
  }

  handleTextApply(): void {
    this.onTextChange()?.(this.tempTextValue());
    this.isFilterOpen.set(false);
  }

  handleTextClear(): void {
    this.tempTextValue.set('');
    this.onTextChange()?.('');
    this.isFilterOpen.set(false);
  }

  // MultiSelect filter handlers
  handleCheckboxChange(option: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const newSet = new Set(this.tempSelected());
    if (checked) {
      newSet.add(option);
    } else {
      newSet.delete(option);
    }
    this.tempSelected.set(newSet);
  }

  handleSelectAllFiltered(): void {
    const newSet = new Set(this.tempSelected());
    for (const opt of this.filteredOptions()) {
      newSet.add(opt);
    }
    this.tempSelected.set(newSet);
  }

  handleClearSelection(): void {
    this.tempSelected.set(new Set());
  }

  handleMultiSelectApply(): void {
    this.onFilterChange()?.([...this.tempSelected()]);
    this.isFilterOpen.set(false);
  }

  handleMultiSelectClear(): void {
    this.tempSelected.set(new Set());
    this.onFilterChange()?.([]);
    this.isFilterOpen.set(false);
  }

  // People filter handlers
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
      const fn = this.peopleSearch();
      if (!fn) return;
      fn(query).then((results) => {
        this.peopleSuggestions.set(results);
        this.isPeopleLoading.set(false);
      }).catch(() => {
        this.peopleSuggestions.set([]);
        this.isPeopleLoading.set(false);
      });
    }, 300);
  }

  handleUserSelect(user: UserLike): void {
    this.onUserChange()?.(user);
    this.isFilterOpen.set(false);
  }

  handleClearUser(): void {
    this.onUserChange()?.(undefined);
    this.isFilterOpen.set(false);
  }

  // Date filter handlers
  handleDateApply(): void {
    const from = this.tempDateFrom();
    const to = this.tempDateTo();
    if (from || to) {
      this.onDateChange()?.({ from, to });
    }
    this.isFilterOpen.set(false);
  }

  handleDateClear(): void {
    this.tempDateFrom.set('');
    this.tempDateTo.set('');
    this.onDateChange()?.({ from: '', to: '' });
    this.isFilterOpen.set(false);
  }
}
