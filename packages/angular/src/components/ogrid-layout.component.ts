import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SideBarComponent } from './sidebar.component';
import type { SideBarProps } from './sidebar.component';
import { GRID_BORDER_RADIUS } from '@alaarab/ogrid-core';

@Component({
  selector: 'ogrid-layout',
  standalone: true,
  imports: [CommonModule, SideBarComponent],
  styles: [`
    :host { display: block; height: 100%; }
    .ogrid-layout-root { display: flex; flex-direction: column; height: 100%; }
    .ogrid-layout-container {
      border: 1px solid var(--ogrid-border, #e0e0e0);
      overflow: hidden; display: flex; flex-direction: column;
      flex: 1; min-height: 0; background: var(--ogrid-bg, #fff);
    }
    .ogrid-layout-toolbar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 6px 12px; background: var(--ogrid-header-bg, #f5f5f5);
      gap: 8px; flex-wrap: wrap; min-height: 0;
    }
    .ogrid-layout-toolbar--has-below { border-bottom: none; }
    .ogrid-layout-toolbar--no-below { border-bottom: 1px solid var(--ogrid-border, #e0e0e0); }
    .ogrid-layout-toolbar-left { display: flex; align-items: center; gap: 8px; }
    .ogrid-layout-toolbar-right { display: flex; align-items: center; gap: 8px; }
    .ogrid-layout-toolbar-below {
      border-bottom: 1px solid var(--ogrid-border, #e0e0e0);
      padding: 6px 12px; background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-layout-grid-area { width: 100%; min-width: 0; min-height: 0; flex: 1; display: flex; }
    .ogrid-layout-grid-content { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
    .ogrid-layout-footer {
      border-top: 1px solid var(--ogrid-border, #e0e0e0);
      background: var(--ogrid-header-bg, #f5f5f5); padding: 6px 12px;
    }
  `],
  template: `
    <div [class]="(className ?? '') + ' ogrid-layout-root'">
      <div class="ogrid-layout-container" [style.border-radius.px]="borderRadius">
        <!-- Toolbar strip -->
        @if (hasToolbar) {
          <div
            class="ogrid-layout-toolbar"
            [class.ogrid-layout-toolbar--has-below]="hasToolbarBelow"
            [class.ogrid-layout-toolbar--no-below]="!hasToolbarBelow"
          >
            <div class="ogrid-layout-toolbar-left">
              <ng-content select="[toolbar]"></ng-content>
            </div>
            <div class="ogrid-layout-toolbar-right">
              <ng-content select="[toolbarEnd]"></ng-content>
            </div>
          </div>
        }

        <!-- Secondary toolbar row -->
        @if (hasToolbarBelow) {
          <div class="ogrid-layout-toolbar-below">
            <ng-content select="[toolbarBelow]"></ng-content>
          </div>
        }

        <!-- Grid area (single ng-content to avoid Angular content projection issues) -->
        <div class="ogrid-layout-grid-area">
          @if (sideBar && sideBar.position === 'left') {
            <ogrid-sidebar [sideBarProps]="sideBar"></ogrid-sidebar>
          }
          <div class="ogrid-layout-grid-content">
            <ng-content></ng-content>
          </div>
          @if (sideBar && sideBar.position !== 'left') {
            <ogrid-sidebar [sideBarProps]="sideBar"></ogrid-sidebar>
          }
        </div>

        <!-- Footer strip (pagination) -->
        @if (hasPagination) {
          <div class="ogrid-layout-footer">
            <ng-content select="[pagination]"></ng-content>
          </div>
        }
      </div>
    </div>
  `,
})
export class OGridLayoutComponent {
  @Input() className?: string;
  @Input() hasToolbar = false;
  @Input() hasToolbarBelow = false;
  @Input() hasPagination = false;
  @Input() sideBar: SideBarProps | null = null;

  readonly borderRadius = GRID_BORDER_RADIUS;
}
