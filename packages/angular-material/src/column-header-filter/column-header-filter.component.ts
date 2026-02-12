import {
  Component, input, output, signal, computed,
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
 * Column header filter component with sort + filter icon + popover.
 * Standalone component with inline template.
 */
@Component({
  selector: 'ogrid-column-header-filter',
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
              &#9660;
            } @else if (isSorted()) {
              &#9650;
            } @else {
              &#8597;
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
            &#9783;
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
              <div class="ogrid-header-filter__popover-actions" style="border-top: 1px solid rgba(0,0,0,0.12);">
                <button class="ogrid-header-filter__action-btn" (click)="handleClearSelection()">Clear</button>
                <button class="ogrid-header-filter__action-btn ogrid-header-filter__action-btn--primary" (click)="handleApplyMultiSelect()">Apply</button>
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
                <div style="padding: 8px 12px; border-top: 1px solid rgba(0,0,0,0.12);">
                  <button class="ogrid-header-filter__action-btn" style="width: 100%;" (click)="handleClearUser()">Clear Filter</button>
                </div>
              }
            </div>
          }
          @case ('date') {
            <div class="ogrid-header-filter__popover-body" style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="min-width: 36px; font-size: 12px;">From:</span>
                <input type="date" [value]="tempDateFrom()" (input)="tempDateFrom.set(asInputValue($event))" style="flex: 1; padding: 4px 6px;" />
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="min-width: 36px; font-size: 12px;">To:</span>
                <input type="date" [value]="tempDateTo()" (input)="tempDateTo.set(asInputValue($event))" style="flex: 1; padding: 4px 6px;" />
              </div>
              <div class="ogrid-header-filter__popover-actions" style="margin-top: 4px;">
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
    :host { display: flex; align-items: center; width: 100%; min-width: 0; position: relative; }
    .ogrid-header-filter { display: flex; align-items: center; width: 100%; min-width: 0; }
    .ogrid-header-filter__label { flex: 1; min-width: 0; overflow: hidden; }
    .ogrid-header-filter__name {
      display: block; font-weight: 600; font-size: 14px; line-height: 1.4;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ogrid-header-filter__actions { display: flex; align-items: center; margin-left: 4px; flex-shrink: 0; }
    .ogrid-header-filter__btn {
      width: 24px; height: 24px; padding: 2px; border: none; border-radius: 4px;
      background: transparent; cursor: pointer; font-size: 12px; line-height: 1;
      display: inline-flex; align-items: center; justify-content: center; position: relative;
      color: rgba(0,0,0,0.54);
    }
    .ogrid-header-filter__btn:hover { background: rgba(0,0,0,0.04); }
    .ogrid-header-filter__btn--active { color: var(--mat-sys-primary, #1976d2); }
    .ogrid-header-filter__dot {
      position: absolute; top: 2px; right: 2px;
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--mat-sys-primary, #1976d2);
    }
    .ogrid-header-filter__popover {
      position: fixed; z-index: 1000;
      background: #fff; border: 1px solid rgba(0,0,0,0.12);
      border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      margin-top: 4px;
    }
    .ogrid-header-filter__popover-header {
      padding: 8px 12px; font-size: 14px; font-weight: 600;
      border-bottom: 1px solid rgba(0,0,0,0.12);
    }
    .ogrid-header-filter__popover-body { }
    .ogrid-header-filter__popover-actions {
      display: flex; justify-content: flex-end; gap: 8px; padding: 8px 12px;
    }
    .ogrid-header-filter__input {
      width: 100%; padding: 8px 12px; border: 1px solid rgba(0,0,0,0.23);
      border-radius: 4px; font-size: 14px; box-sizing: border-box;
    }
    .ogrid-header-filter__input:focus { outline: 2px solid var(--mat-sys-primary, #1976d2); outline-offset: -1px; }
    .ogrid-header-filter__options-info { margin-top: 4px; font-size: 12px; color: rgba(0,0,0,0.6); }
    .ogrid-header-filter__select-actions {
      display: flex; justify-content: space-between; padding: 4px 12px;
    }
    .ogrid-header-filter__options-list { max-height: 240px; overflow-y: auto; padding: 0 4px; }
    .ogrid-header-filter__option {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 8px; cursor: pointer; font-size: 14px;
    }
    .ogrid-header-filter__option:hover { background: rgba(0,0,0,0.04); }
    .ogrid-header-filter__loading, .ogrid-header-filter__empty {
      padding: 16px; text-align: center; font-size: 14px; color: rgba(0,0,0,0.6);
    }
    .ogrid-header-filter__action-btn {
      padding: 4px 12px; border: none; border-radius: 4px;
      background: transparent; cursor: pointer; font-size: 13px;
    }
    .ogrid-header-filter__action-btn:hover { background: rgba(0,0,0,0.04); }
    .ogrid-header-filter__action-btn:disabled { opacity: 0.38; cursor: default; }
    .ogrid-header-filter__action-btn--primary {
      background: var(--mat-sys-primary, #1976d2); color: #fff;
    }
    .ogrid-header-filter__action-btn--primary:hover { background: var(--mat-sys-primary, #1565c0); }
    .ogrid-header-filter__people-selected {
      padding: 12px; border-bottom: 1px solid rgba(0,0,0,0.12);
    }
    .ogrid-header-filter__people-info-label { font-size: 12px; color: rgba(0,0,0,0.6); }
    .ogrid-header-filter__people-card {
      display: flex; align-items: center; gap: 8px; margin-top: 4px;
    }
    .ogrid-header-filter__people-avatar {
      width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.08);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 600; flex-shrink: 0;
    }
    .ogrid-header-filter__people-details { flex: 1; min-width: 0; font-size: 14px; }
    .ogrid-header-filter__people-details > div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ogrid-header-filter__people-email { font-size: 12px; color: rgba(0,0,0,0.6); }
    .ogrid-header-filter__people-option {
      display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer;
    }
    .ogrid-header-filter__people-option:hover { background: rgba(0,0,0,0.04); }
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
  readonly selectedValues = input<string[] | undefined>(undefined);
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

  private readonly headerEl = viewChild<ElementRef<HTMLElement>>('headerEl');

  // Internal state
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

  readonly hasActiveFilter = computed(() => {
    const ft = this.filterType();
    if (ft === 'text') return !!this.textValue();
    if (ft === 'multiSelect') return (this.selectedValues()?.length ?? 0) > 0;
    if (ft === 'people') return this.selectedUser() != null;
    if (ft === 'date') return this.dateValue() != null;
    return false;
  });

  readonly filteredOptions = computed(() => {
    const opts = this.options() ?? [];
    const search = this.searchText().toLowerCase().trim();
    if (!search) return opts;
    return opts.filter((o) => o.toLowerCase().includes(search));
  });

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
    this.tempTextValue.set(this.textValue());
    this.tempSelected.set(new Set(this.selectedValues() ?? []));
    this.searchText.set('');
    this.peopleSearchText.set('');
    this.peopleSuggestions.set([]);
    const dv = this.dateValue();
    this.tempDateFrom.set(dv?.from ?? '');
    this.tempDateTo.set(dv?.to ?? '');

    // Compute popover position
    const el = this.headerEl()?.nativeElement;
    if (el) {
      const rect = el.getBoundingClientRect();
      this.popoverTop.set(rect.bottom + 4);
      this.popoverLeft.set(rect.left);
    }
    this.isFilterOpen.set(true);
  }

  // --- Text filter ---
  onTextKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      this.handleTextApply();
    }
  }

  handleTextApply(): void {
    this.onTextChange()!(this.tempTextValue());
    this.isFilterOpen.set(false);
  }

  handleTextClear(): void {
    this.tempTextValue.set('');
    this.onTextChange()!('');
    this.isFilterOpen.set(false);
  }

  // --- MultiSelect filter ---
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
    this.onFilterChange()!(Array.from(this.tempSelected()));
    this.isFilterOpen.set(false);
  }

  // --- People filter ---
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
    this.onUserChange()!(user);
    this.isFilterOpen.set(false);
  }

  handleClearUser(): void {
    this.onUserChange()!(undefined);
    this.isFilterOpen.set(false);
  }

  // --- Date filter ---
  handleDateApply(): void {
    const from = this.tempDateFrom();
    const to = this.tempDateTo();
    if (!from && !to) {
      this.onDateChange()!(undefined);
    } else {
      this.onDateChange()!({ from: from || undefined, to: to || undefined });
    }
    this.isFilterOpen.set(false);
  }

  handleDateClear(): void {
    this.tempDateFrom.set('');
    this.tempDateTo.set('');
    this.onDateChange()!(undefined);
    this.isFilterOpen.set(false);
  }

  onDocumentClick(event: MouseEvent): void {
    const el = event.target as HTMLElement;
    if (!el.closest('ogrid-column-header-filter') && !el.closest('.ogrid-header-filter__popover')) {
      this.isFilterOpen.set(false);
    }
  }
}
