import { Component, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { SideBarComponent } from './sidebar.component';
import type { SideBarProps } from './sidebar.component';
import { GRID_BORDER_RADIUS } from '@alaarab/ogrid-core';

@Component({
  selector: 'ogrid-layout',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SideBarComponent],
  styles: [`
    /* ─── OGrid Theme Variables ─── */
    :root {
      --ogrid-bg: #ffffff;
      --ogrid-fg: rgba(0, 0, 0, 0.87);
      --ogrid-fg-secondary: rgba(0, 0, 0, 0.6);
      --ogrid-fg-muted: rgba(0, 0, 0, 0.5);
      --ogrid-border: rgba(0, 0, 0, 0.12);
      --ogrid-header-bg: rgba(0, 0, 0, 0.04);
      --ogrid-hover-bg: rgba(0, 0, 0, 0.04);
      --ogrid-selected-row-bg: #e6f0fb;
      --ogrid-active-cell-bg: rgba(0, 0, 0, 0.02);
      --ogrid-range-bg: rgba(33, 115, 70, 0.12);
      --ogrid-accent: #0078d4;
      --ogrid-selection-color: #217346;
      --ogrid-loading-overlay: rgba(255, 255, 255, 0.7);
    }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        --ogrid-bg: #1e1e1e;
        --ogrid-fg: rgba(255, 255, 255, 0.87);
        --ogrid-fg-secondary: rgba(255, 255, 255, 0.6);
        --ogrid-fg-muted: rgba(255, 255, 255, 0.5);
        --ogrid-border: rgba(255, 255, 255, 0.12);
        --ogrid-header-bg: rgba(255, 255, 255, 0.06);
        --ogrid-hover-bg: rgba(255, 255, 255, 0.08);
        --ogrid-selected-row-bg: #1a3a5c;
        --ogrid-active-cell-bg: rgba(255, 255, 255, 0.06);
        --ogrid-range-bg: rgba(46, 160, 67, 0.15);
        --ogrid-accent: #4da6ff;
        --ogrid-selection-color: #2ea043;
        --ogrid-loading-overlay: rgba(0, 0, 0, 0.7);
      }
    }
    [data-theme="dark"] {
      --ogrid-bg: #1e1e1e;
      --ogrid-fg: rgba(255, 255, 255, 0.87);
      --ogrid-fg-secondary: rgba(255, 255, 255, 0.6);
      --ogrid-fg-muted: rgba(255, 255, 255, 0.5);
      --ogrid-border: rgba(255, 255, 255, 0.12);
      --ogrid-header-bg: rgba(255, 255, 255, 0.06);
      --ogrid-hover-bg: rgba(255, 255, 255, 0.08);
      --ogrid-selected-row-bg: #1a3a5c;
      --ogrid-active-cell-bg: rgba(255, 255, 255, 0.06);
      --ogrid-range-bg: rgba(46, 160, 67, 0.15);
      --ogrid-accent: #4da6ff;
      --ogrid-selection-color: #2ea043;
      --ogrid-loading-overlay: rgba(0, 0, 0, 0.7);
    }
    :host { display: block; height: 100%; }
    .ogrid-layout-root { display: flex; flex-direction: column; height: 100%; }
    .ogrid-layout-container {
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      overflow: hidden; display: flex; flex-direction: column;
      flex: 1; min-height: 0; background: var(--ogrid-bg, #ffffff);
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-layout-toolbar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 6px 12px; background: var(--ogrid-header-bg, rgba(0, 0, 0, 0.04));
      gap: 8px; flex-wrap: wrap; min-height: 0;
    }
    .ogrid-layout-toolbar--has-below { border-bottom: none; }
    .ogrid-layout-toolbar--no-below { border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12)); }
    .ogrid-layout-toolbar-left { display: flex; align-items: center; gap: 8px; }
    .ogrid-layout-toolbar-right { display: flex; align-items: center; gap: 8px; }
    .ogrid-layout-toolbar-below {
      border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      padding: 6px 12px; background: var(--ogrid-header-bg, rgba(0, 0, 0, 0.04));
    }
    .ogrid-layout-grid-area { width: 100%; min-width: 0; min-height: 0; flex: 1; display: flex; }
    .ogrid-layout-grid-content { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
    .ogrid-layout-footer {
      border-top: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      background: var(--ogrid-header-bg, rgba(0, 0, 0, 0.04)); padding: 6px 12px;
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
