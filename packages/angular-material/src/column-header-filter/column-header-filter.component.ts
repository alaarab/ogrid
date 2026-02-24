import { Component, ChangeDetectionStrategy, ElementRef, ViewChild } from '@angular/core';
import { BaseColumnHeaderFilterComponent } from '@alaarab/ogrid-angular';

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
        <span class="ogrid-header-filter__name" [title]="columnName" data-header-label>
          {{ columnName }}
        </span>
      </div>

      <div class="ogrid-header-filter__actions">
        @if (filterType !== 'none') {
          <button
            class="ogrid-header-filter__filter-btn"
            [class.ogrid-header-filter__filter-btn--active]="hasActiveFilter() || isFilterOpen()"
            (click)="toggleFilter($event)"
            [attr.aria-label]="'Filter ' + columnName"
            [attr.aria-expanded]="isFilterOpen()"
            aria-haspopup="dialog"
            [title]="'Filter ' + columnName"
          >
            <span class="ogrid-header-filter__funnel"></span>
            @if (hasActiveFilter()) {
              <span class="ogrid-header-filter__dot"></span>
            }
          </button>
        }
      </div>
    </div>

    @if (isFilterOpen() && filterType !== 'none') {
      <div
        class="ogrid-header-filter__popover"
        [style.top.px]="popoverTop()"
        [style.left.px]="popoverLeft()"
        (click)="$event.stopPropagation()"
      >
        <div class="ogrid-header-filter__popover-header">
          Filter: {{ columnName }}
        </div>

        @switch (filterType) {
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
                  {{ filteredOptions().length }} of {{ (options ?? []).length }} options
                </div>
              </div>
              <div class="ogrid-header-filter__select-actions">
                <button class="ogrid-header-filter__action-btn" (click)="handleSelectAllFiltered()">
                  Select All ({{ filteredOptions().length }})
                </button>
                <button class="ogrid-header-filter__action-btn" (click)="handleClearSelection()">Clear</button>
              </div>
              <div class="ogrid-header-filter__options-list">
                @if (isLoadingOptions) {
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
              @if (selectedUser) {
                <div class="ogrid-header-filter__people-selected">
                  <div class="ogrid-header-filter__people-info-label">Currently filtered by:</div>
                  <div class="ogrid-header-filter__people-card">
                    <div class="ogrid-header-filter__people-avatar">{{ selectedUser!.displayName?.[0] ?? '?' }}</div>
                    <div class="ogrid-header-filter__people-details">
                      <div>{{ selectedUser!.displayName }}</div>
                      <div class="ogrid-header-filter__people-email">{{ selectedUser!.email }}</div>
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
              @if (selectedUser) {
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
    :host { display: flex; align-items: center; flex: 1; min-width: 0; position: relative; }
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
      color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.54));
    }
    .ogrid-header-filter__btn:hover { background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.08)); }
    .ogrid-header-filter__btn--active { color: var(--mat-sys-primary, #1976d2); }
    .ogrid-header-filter__filter-btn {
      width: 24px; height: 24px; padding: 2px; border: none; border-radius: 4px;
      background: transparent; cursor: pointer; line-height: 1;
      display: inline-flex; align-items: center; justify-content: center; position: relative;
      opacity: 0.6; transition: opacity 0.15s;
    }
    .ogrid-header-filter:hover .ogrid-header-filter__filter-btn { opacity: 0.8; }
    /* :hover and --active must override the parent-hover rule (0,2,0) — double-class raises to 0,3,0 */
    .ogrid-header-filter .ogrid-header-filter__filter-btn:hover { background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.08)); opacity: 1; }
    .ogrid-header-filter .ogrid-header-filter__filter-btn--active { opacity: 1; }
    .ogrid-header-filter__funnel {
      display: block; width: 0; height: 0;
      border-left: 5px solid transparent; border-right: 5px solid transparent;
      border-top: 6px solid var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.65));
      position: relative;
    }
    .ogrid-header-filter__funnel::after {
      content: ''; display: block; width: 2px; height: 4px;
      background: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.65)); position: absolute;
      top: -1px; left: -1px;
    }
    .ogrid-header-filter__filter-btn--active .ogrid-header-filter__funnel {
      border-top-color: var(--mat-sys-primary, #1976d2);
    }
    .ogrid-header-filter__filter-btn--active .ogrid-header-filter__funnel::after {
      background: var(--mat-sys-primary, #1976d2);
    }
    .ogrid-header-filter__dot {
      position: absolute; top: 2px; right: 2px;
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--mat-sys-primary, #1976d2);
    }
    .ogrid-header-filter__popover {
      position: fixed; z-index: 1000;
      background: var(--ogrid-bg, #ffffff); border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.2));
      border-radius: 8px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), 0 1px 4px rgba(0, 0, 0, 0.1);
      margin-top: 4px; color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-header-filter__popover-header {
      padding: 8px 12px; font-size: 14px; font-weight: 600;
      border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-header-filter__popover-body { }
    .ogrid-header-filter__popover-actions {
      display: flex; justify-content: flex-end; gap: 8px; padding: 8px 12px;
    }
    .ogrid-header-filter__input {
      width: 100%; padding: 8px 12px; border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.23));
      border-radius: 4px; font-size: 14px; box-sizing: border-box;
      background: var(--ogrid-bg, #ffffff); color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-header-filter__input:focus { outline: 2px solid var(--mat-sys-primary, #1976d2); outline-offset: -1px; }
    .ogrid-header-filter__options-info { margin-top: 4px; font-size: 12px; color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6)); }
    .ogrid-header-filter__select-actions {
      display: flex; justify-content: space-between; padding: 4px 12px;
    }
    .ogrid-header-filter__options-list { max-height: 240px; overflow-y: auto; padding: 0 4px; }
    .ogrid-header-filter__option {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 8px; cursor: pointer; font-size: 14px;
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-header-filter__option:hover { background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04)); }
    .ogrid-header-filter__loading, .ogrid-header-filter__empty {
      padding: 16px; text-align: center; font-size: 14px; color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6));
    }
    .ogrid-header-filter__action-btn {
      padding: 4px 12px; border: none; border-radius: 4px;
      background: transparent; cursor: pointer; font-size: 13px;
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-header-filter__action-btn:hover { background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04)); }
    .ogrid-header-filter__action-btn:disabled { opacity: 0.38; cursor: default; }
    .ogrid-header-filter__action-btn--primary {
      background: var(--mat-sys-primary, #1976d2); color: #fff;
    }
    .ogrid-header-filter__action-btn--primary:hover { opacity: 0.9; }
    .ogrid-header-filter__people-selected {
      padding: 12px; border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
    }
    .ogrid-header-filter__people-info-label { font-size: 12px; color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6)); }
    .ogrid-header-filter__people-card {
      display: flex; align-items: center; gap: 8px; margin-top: 4px;
    }
    .ogrid-header-filter__people-avatar {
      width: 32px; height: 32px; border-radius: 50%; background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.08));
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 600; flex-shrink: 0;
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-header-filter__people-details { flex: 1; min-width: 0; font-size: 14px; color: var(--ogrid-fg, rgba(0, 0, 0, 0.87)); }
    .ogrid-header-filter__people-details > div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ogrid-header-filter__people-email { font-size: 12px; color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6)); }
    .ogrid-header-filter__people-option {
      display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer;
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-header-filter__people-option:hover { background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04)); }
  `],
  host: {
    '(document:click)': 'onDocumentClickWrapper($event)',
  },
})
export class ColumnHeaderFilterComponent extends BaseColumnHeaderFilterComponent {
  @ViewChild('headerEl') private headerEl?: ElementRef<HTMLElement>;

  protected getHeaderEl(): ElementRef<HTMLElement> | undefined {
    return this.headerEl;
  }

  onDocumentClickWrapper(event: MouseEvent): void {
    this.onDocumentClick(event, 'ogrid-column-header-filter');
  }
}
