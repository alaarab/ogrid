import { Component, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { SideBarComponent } from './sidebar.component';
import type { SideBarProps } from './sidebar.component';
import { FormulaBarComponent } from './formula-bar.component';
import { SheetTabsComponent } from './sheet-tabs.component';
import type { OGridFormulaBarState } from '../services/ogrid.service';
import { GRID_BORDER_RADIUS } from '@alaarab/ogrid-core';
import type { ISheetDef } from '@alaarab/ogrid-core';
import { OGRID_THEME_VARS_CSS } from '../styles/ogrid-theme-vars';

@Component({
  selector: 'ogrid-layout',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SideBarComponent, FormulaBarComponent, SheetTabsComponent],
  styles: [OGRID_THEME_VARS_CSS, `
    :host { display: block; height: 100%; }
    .ogrid-layout-root { display: flex; flex-direction: column; height: 100%; }
    .ogrid-layout-root--fullscreen {
      position: fixed; inset: 0; z-index: 9999;
      background: var(--ogrid-bg, #ffffff);
    }
    .ogrid-layout-container {
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      overflow: hidden; display: flex; flex-direction: column;
      flex: 1; min-height: 0; background: var(--ogrid-bg, #ffffff);
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-layout-root--fullscreen .ogrid-layout-container {
      border: none;
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
    .ogrid-layout-grid-content { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
    .ogrid-layout-footer {
      border-top: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      background: var(--ogrid-header-bg, rgba(0, 0, 0, 0.04)); padding: 6px 12px;
    }
    .ogrid-fullscreen-btn {
      background: none; border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      border-radius: 4px; padding: 4px 6px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-fullscreen-btn:hover { background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04)); }
    .ogrid-name-box {
      display: inline-flex; align-items: center; padding: 0 8px;
      font-family: 'Consolas', 'Courier New', monospace; font-size: 12px;
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12)); border-radius: 3px;
      height: 24px; margin-right: 8px; background: var(--ogrid-bg, #fff);
      min-width: 40px; color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6));
    }
  `],
  template: `
    <div [class]="rootClass">
      <div class="ogrid-layout-container" [style.border-radius.px]="isFullScreen ? 0 : borderRadius">
        <!-- Toolbar strip -->
        @if (hasToolbar || fullScreen || showNameBox) {
          <div
            class="ogrid-layout-toolbar"
            [class.ogrid-layout-toolbar--has-below]="hasToolbarBelow"
            [class.ogrid-layout-toolbar--no-below]="!hasToolbarBelow"
          >
            <div class="ogrid-layout-toolbar-left">
              @if (showNameBox) {
                <div class="ogrid-name-box">{{ activeCellRef ?? '\u2014' }}</div>
              }
              <ng-content select="[toolbar]"></ng-content>
            </div>
            <div class="ogrid-layout-toolbar-right">
              <ng-content select="[toolbarEnd]"></ng-content>
              @if (fullScreen) {
                <button type="button" class="ogrid-fullscreen-btn"
                  [attr.title]="isFullScreen ? 'Exit fullscreen' : 'Fullscreen'"
                  [attr.aria-label]="isFullScreen ? 'Exit fullscreen' : 'Fullscreen'"
                  (click)="toggleFullScreen()">
                  @if (isFullScreen) {
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="4 10 0 10 0 14"></polyline>
                      <polyline points="12 6 16 6 16 2"></polyline>
                      <line x1="0" y1="10" x2="4" y2="6"></line>
                      <line x1="16" y1="6" x2="12" y2="10"></line>
                    </svg>
                  } @else {
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="10 2 14 2 14 6"></polyline>
                      <polyline points="6 14 2 14 2 10"></polyline>
                      <line x1="14" y1="2" x2="10" y2="6"></line>
                      <line x1="2" y1="14" x2="6" y2="10"></line>
                    </svg>
                  }
                </button>
              }
            </div>
          </div>
        }

        <!-- Secondary toolbar row -->
        @if (hasToolbarBelow) {
          <div class="ogrid-layout-toolbar-below">
            <ng-content select="[toolbarBelow]"></ng-content>
          </div>
        }

        <!-- Formula bar (between toolbar and grid) -->
        @if (formulaBar) {
          <ogrid-formula-bar
            [cellRef]="formulaBar.cellRef"
            [formulaText]="formulaBar.formulaText"
            [isEditing]="formulaBar.isEditing"
            (inputChange)="formulaBar.onInputChange($event)"
            (commit)="formulaBar.onCommit()"
            (cancel)="formulaBar.onCancel()"
            (startEditing)="formulaBar.startEditing()"
          />
        }

        <!-- Grid area -->
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

        <!-- Sheet tabs (between grid and footer) -->
        @if (sheetDefs && sheetDefs.length > 0 && activeSheet) {
          <ogrid-sheet-tabs
            [sheets]="sheetDefs"
            [activeSheet]="activeSheet"
            [showAddButton]="!!onSheetAdd"
            (sheetChange)="onSheetChange?.($event)"
            (sheetAdd)="onSheetAdd?.()"
          />
        }

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
  @Input() fullScreen = false;
  @Input() showNameBox = false;
  @Input() activeCellRef: string | null = null;
  @Input() formulaBar: OGridFormulaBarState | null = null;
  @Input() sheetDefs: ISheetDef[] | undefined;
  @Input() activeSheet: string | undefined;
  @Input() onSheetChange: ((sheetId: string) => void) | undefined;
  @Input() onSheetAdd: (() => void) | undefined;

  isFullScreen = false;
  readonly borderRadius = GRID_BORDER_RADIUS;

  private escListener: ((e: KeyboardEvent) => void) | null = null;

  get rootClass(): string {
    const base = (this.className ?? '') + ' ogrid-layout-root';
    return this.isFullScreen ? base + ' ogrid-layout-root--fullscreen' : base;
  }

  toggleFullScreen(): void {
    this.isFullScreen = !this.isFullScreen;
    if (this.isFullScreen) {
      this.escListener = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          this.isFullScreen = false;
          this.removeEscListener();
        }
      };
      document.addEventListener('keydown', this.escListener);
    } else {
      this.removeEscListener();
    }
  }

  private removeEscListener(): void {
    if (this.escListener) {
      document.removeEventListener('keydown', this.escListener);
      this.escListener = null;
    }
  }
}
