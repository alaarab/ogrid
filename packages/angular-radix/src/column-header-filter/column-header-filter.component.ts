import { Component, ChangeDetectionStrategy, ElementRef, ViewChild } from '@angular/core';
import { BaseColumnHeaderFilterComponent } from '@alaarab/ogrid-angular';

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
        <span class="ogrid-header-filter__name" [title]="columnName" data-header-label>
          {{ columnName }}
        </span>
      </div>

      <div class="ogrid-header-filter__actions">
        @if (filterType !== 'none') {
          <button
            class="ogrid-header-filter__btn"
            [class.ogrid-header-filter__btn--active]="hasActiveFilter() || isFilterOpen()"
            (click)="toggleFilter($event)"
            [attr.aria-label]="'Filter ' + columnName"
            [attr.aria-expanded]="isFilterOpen()"
            aria-haspopup="dialog"
            [title]="'Filter ' + columnName"
          >
            ⏷
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
              <div class="ogrid-header-filter__popover-actions" style="border-top: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));">
                <button class="ogrid-header-filter__action-btn" [disabled]="tempSelected().size === 0" (click)="handleMultiSelectClear()">Clear</button>
                <button class="ogrid-header-filter__action-btn ogrid-header-filter__action-btn--primary" (click)="handleMultiSelectApply()">Apply</button>
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
                <div style="padding: 8px 12px; border-top: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));">
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
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
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
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      border-radius: 4px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      min-width: 200px;
    }
    .ogrid-header-filter__popover-header {
      padding: 8px 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--ogrid-fg, #242424);
      border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-header-filter__popover-body {
      display: flex;
      flex-direction: column;
    }
    .ogrid-header-filter__input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
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
      border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
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
      font-size: 13px;
      color: var(--ogrid-fg, #242424);
      transition: background 0.15s ease;
    }
    .ogrid-header-filter__option:hover {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
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
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      border-radius: 4px;
      background: var(--ogrid-bg, #ffffff);
      color: var(--ogrid-fg, #242424);
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s ease;
    }
    .ogrid-header-filter__action-btn:hover:not(:disabled) {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
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
      border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
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
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
    }
  `],
  host: {
    '(document:click)': 'onDocumentClickWrapper($event)',
  },
})
export class ColumnHeaderFilterComponent extends BaseColumnHeaderFilterComponent {
  @ViewChild('headerEl') private headerRef?: ElementRef<HTMLElement>;

  protected getHeaderEl(): ElementRef<HTMLElement> | undefined {
    return this.headerRef;
  }

  onDocumentClickWrapper(event: MouseEvent): void {
    this.onDocumentClick(event, 'column-header-filter');
  }

  // Adapter methods for template compatibility (Radix uses different method names)
  handleMultiSelectApply(): void {
    this.handleApplyMultiSelect();
  }

  handleMultiSelectClear(): void {
    this.handleClearSelection();
    this.onFilterChange?.([]);
    this.isFilterOpen.set(false);
  }
}
