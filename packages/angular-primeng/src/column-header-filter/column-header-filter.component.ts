import { Component, ElementRef, ViewChild, DestroyRef, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseColumnHeaderFilterComponent } from '@alaarab/ogrid-angular';

@Component({
  selector: 'ogrid-primeng-column-header-filter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="display:flex;align-items:center;flex:1;min-width:0;gap:4px">
      <div style="flex:1;min-width:0;overflow:hidden">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block" [title]="columnName" data-header-label>
          {{ columnName }}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:2px;flex-shrink:0">
        @if (filterType !== 'none') {
          <button
            type="button"
            #filterTrigger
            (click)="toggleFilter()"
            [attr.aria-label]="'Filter ' + columnName"
            [title]="'Filter ' + columnName"
            style="border:none;background:transparent;cursor:pointer;padding:2px 4px;font-size:12px;position:relative;color:var(--ogrid-fg, #242424)"
            [style.font-weight]="hasActiveFilter() ? 'bold' : 'normal'"
          >
            &#9662;
            @if (hasActiveFilter()) {
              <span style="position:absolute;top:0;right:0;width:6px;height:6px;border-radius:50%;background:var(--ogrid-selection, #217346)"></span>
            }
          </button>

          @if (isFilterOpen()) {
            <div
              #filterPanel
              style="position:absolute;top:100%;left:0;z-index:200;min-width:200px;background:var(--ogrid-bg, #fff);border:1px solid var(--ogrid-border, #e0e0e0);border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.12);font-weight:normal"
            >
              <div style="padding:8px 12px;font-weight:600;font-size:12px;border-bottom:1px solid var(--ogrid-border, #e0e0e0)">
                Filter: {{ columnName }}
              </div>

              @if (filterType === 'text') {
                <div style="padding:8px 12px">
                  <input
                    type="text"
                    [value]="tempTextValue()"
                    (input)="tempTextValue.set($any($event.target).value)"
                    placeholder="Filter text..."
                    style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--ogrid-border, #e0e0e0);border-radius:4px;font-size:13px;background:var(--ogrid-bg, #fff);color:var(--ogrid-fg, #242424)"
                    [attr.aria-label]="'Filter ' + columnName"
                  />
                </div>
                <div style="display:flex;justify-content:flex-end;gap:6px;padding:6px 12px;border-top:1px solid var(--ogrid-border, #e0e0e0)">
                  <button
                    type="button"
                    class="p-button p-button-text p-button-sm"
                    (click)="handleTextClear()"
                    [disabled]="!textValue"
                    style="font-size:12px"
                  >Clear</button>
                  <button
                    type="button"
                    class="p-button p-button-sm"
                    (click)="handleTextApply()"
                    style="font-size:12px"
                  >Apply</button>
                </div>
              }

              @if (filterType === 'multiSelect') {
                <div style="padding:8px 12px">
                  <input
                    type="text"
                    [value]="searchText()"
                    (input)="searchText.set($any($event.target).value)"
                    placeholder="Search options..."
                    style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--ogrid-border, #e0e0e0);border-radius:4px;font-size:13px;margin-bottom:6px;background:var(--ogrid-bg, #fff);color:var(--ogrid-fg, #242424)"
                    [attr.aria-label]="'Search ' + columnName + ' options'"
                  />
                  @if (isLoadingOptions) {
                    <div style="padding:8px 0;color:var(--ogrid-fg-muted, rgba(0, 0, 0, 0.5));font-size:12px">Loading...</div>
                  } @else {
                    <div style="display:flex;gap:4px;margin-bottom:6px">
                      <button type="button" class="p-button p-button-text p-button-sm" (click)="handleSelectAllOptions()" style="font-size:11px">All</button>
                      <button type="button" class="p-button p-button-text p-button-sm" (click)="handleClearSelection()" style="font-size:11px">None</button>
                    </div>
                    <div style="max-height:160px;overflow-y:auto" role="group" [attr.aria-label]="columnName + ' filter options'">
                      @for (opt of filteredOptions(); track opt) {
                        <label style="display:flex;align-items:center;gap:6px;padding:2px 0;cursor:pointer;font-size:13px">
                          <input
                            type="checkbox"
                            [checked]="tempSelected().has(opt)"
                            (change)="handleCheckboxChange(opt, $event)"
                          />
                          {{ opt }}
                        </label>
                      }
                    </div>
                  }
                </div>
                <div style="display:flex;justify-content:flex-end;gap:6px;padding:6px 12px;border-top:1px solid var(--ogrid-border, #e0e0e0)">
                  <button
                    type="button"
                    class="p-button p-button-sm"
                    (click)="handleApplyMultiSelect()"
                    style="font-size:12px"
                  >Apply</button>
                </div>
              }

              @if (filterType === 'people') {
                <div style="padding:8px 12px">
                  @if (selectedUser) {
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;margin-bottom:4px">
                      <span style="font-size:13px">{{ selectedUser!.displayName ?? selectedUser!.email }}</span>
                      <button type="button" class="p-button p-button-text p-button-sm" (click)="handleClearUser()" style="font-size:11px">Clear</button>
                    </div>
                  }
                  <input
                    type="text"
                    [value]="peopleSearchText()"
                    (input)="onPeopleSearchInput($any($event.target).value)"
                    placeholder="Search people..."
                    style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--ogrid-border, #e0e0e0);border-radius:4px;font-size:13px;background:var(--ogrid-bg, #fff);color:var(--ogrid-fg, #242424)"
                    [attr.aria-label]="'Search people for ' + columnName"
                  />
                  @if (isPeopleLoading()) {
                    <div style="padding:8px 0;color:var(--ogrid-fg-muted, rgba(0, 0, 0, 0.5));font-size:12px">Loading...</div>
                  }
                  @for (user of peopleSuggestions(); track user.email) {
                    <button
                      type="button"
                      (click)="handleUserSelect(user)"
                      style="display:block;width:100%;text-align:left;padding:6px 0;border:none;background:transparent;cursor:pointer;font-size:13px;color:var(--ogrid-fg, #242424)"
                    >
                      {{ user.displayName ?? user.email }}
                    </button>
                  }
                </div>
              }

              @if (filterType === 'date') {
                <div style="padding:8px 12px;display:flex;flex-direction:column;gap:6px">
                  <label style="display:flex;align-items:center;gap:6px;font-size:12px">
                    From:
                    <input
                      type="date"
                      [value]="tempDateFrom()"
                      (change)="tempDateFrom.set($any($event.target).value)"
                      style="flex:1;padding:4px 6px;border:1px solid var(--ogrid-border, #e0e0e0);border-radius:4px;background:var(--ogrid-bg, #fff);color:var(--ogrid-fg, #242424)"
                    />
                  </label>
                  <label style="display:flex;align-items:center;gap:6px;font-size:12px">
                    To:
                    <input
                      type="date"
                      [value]="tempDateTo()"
                      (change)="tempDateTo.set($any($event.target).value)"
                      style="flex:1;padding:4px 6px;border:1px solid var(--ogrid-border, #e0e0e0);border-radius:4px;background:var(--ogrid-bg, #fff);color:var(--ogrid-fg, #242424)"
                    />
                  </label>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:6px;padding:6px 12px;border-top:1px solid var(--ogrid-border, #e0e0e0)">
                  <button
                    type="button"
                    class="p-button p-button-text p-button-sm"
                    (click)="handleDateClear()"
                    [disabled]="!tempDateFrom() && !tempDateTo()"
                    style="font-size:12px"
                  >Clear</button>
                  <button
                    type="button"
                    class="p-button p-button-sm"
                    (click)="handleDateApply()"
                    style="font-size:12px"
                  >Apply</button>
                </div>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      position: relative;
      flex: 1;
      min-width: 0;
    }
  `],
})
export class ColumnHeaderFilterComponent extends BaseColumnHeaderFilterComponent {
  private destroyRef = inject(DestroyRef);

  @ViewChild('filterTrigger') filterTrigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('filterPanel') filterPanel?: ElementRef<HTMLDivElement>;

  protected getHeaderEl(): ElementRef<HTMLElement> | undefined {
    return this.filterTrigger;
  }

  private clickOutsideHandler = (e: MouseEvent) => {
    const trigger = this.filterTrigger?.nativeElement;
    const panel = this.filterPanel?.nativeElement;
    if (trigger && !trigger.contains(e.target as Node) && (!panel || !panel.contains(e.target as Node))) {
      this.isFilterOpen.set(false);
    }
  };

  constructor() {
    super();
    // Sync temp values when filter opens
    effect(() => {
      if (this.isFilterOpen()) {
        this.tempTextValue.set(this.textValue ?? '');
        this.searchText.set('');
        const sv = this.selectedValues;
        this.tempSelected.set(new Set(sv ?? []));
        const dv = this.dateValue;
        this.tempDateFrom.set(dv?.from ?? '');
        this.tempDateTo.set(dv?.to ?? '');

        document.addEventListener('mousedown', this.clickOutsideHandler, true);
      } else {
        document.removeEventListener('mousedown', this.clickOutsideHandler, true);
      }
    });

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('mousedown', this.clickOutsideHandler, true);
    });
  }

  handleSortClick(): void {
    this.onSort?.();
  }

  toggleFilter(): void {
    this.isFilterOpen.update((v) => !v);
  }

  // Adapter methods for template compatibility
  handleSelectAllOptions(): void {
    this.handleSelectAllFiltered();
  }
}
