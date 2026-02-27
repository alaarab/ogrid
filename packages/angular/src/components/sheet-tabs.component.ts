/**
 * SheetTabsComponent -- Excel-style sheet tab bar at the bottom of the grid.
 *
 * Layout: [+] [Sheet1] [Sheet2] [Sheet3]
 *
 * Uses --ogrid-* CSS variables for theming.
 * Port of React's SheetTabs component.
 */

import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  input,
  output,
} from '@angular/core';
import type { ISheetDef } from '@alaarab/ogrid-core';

@Component({
  selector: 'ogrid-sheet-tabs',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .ogrid-sheet-tabs {
      display: flex;
      align-items: center;
      border-top: 1px solid var(--ogrid-border, #e0e0e0);
      background: var(--ogrid-header-bg, #f5f5f5);
      min-height: 30px;
      overflow-x: auto;
      overflow-y: hidden;
      gap: 0;
      font-size: 12px;
    }
    .ogrid-sheet-tabs__add-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 10px;
      font-size: 16px;
      line-height: 22px;
      color: var(--ogrid-fg-secondary, #666);
      flex-shrink: 0;
    }
    .ogrid-sheet-tabs__tab {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      padding: 4px 16px;
      font-size: 12px;
      line-height: 22px;
      color: var(--ogrid-fg, #242424);
      white-space: nowrap;
      position: relative;
    }
    .ogrid-sheet-tabs__tab--active {
      font-weight: 600;
      border-bottom-color: var(--ogrid-primary, #217346);
      background: var(--ogrid-bg, #fff);
    }
  `],
  template: `
    <div class="ogrid-sheet-tabs" role="tablist" aria-label="Sheet tabs">
      @if (showAddButton()) {
        <button
          type="button"
          class="ogrid-sheet-tabs__add-btn"
          (click)="sheetAdd.emit()"
          title="Add sheet"
          aria-label="Add sheet"
        >+</button>
      }
      @for (sheet of sheets(); track sheet.id) {
        @let isActive = sheet.id === activeSheet();
        <button
          type="button"
          role="tab"
          class="ogrid-sheet-tabs__tab"
          [class.ogrid-sheet-tabs__tab--active]="isActive"
          [attr.aria-selected]="isActive"
          [style.border-bottom-color]="isActive && sheet.color ? sheet.color : null"
          (click)="sheetChange.emit(sheet.id)"
        >{{ sheet.name }}</button>
      }
    </div>
  `,
})
export class SheetTabsComponent {
  readonly sheets = input.required<ISheetDef[]>();
  readonly activeSheet = input.required<string>();
  readonly showAddButton = input<boolean>(false);
  readonly sheetChange = output<string>();
  readonly sheetAdd = output();
}
