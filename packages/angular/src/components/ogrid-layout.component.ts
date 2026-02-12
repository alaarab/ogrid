import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SideBarComponent } from './sidebar.component';
import type { SideBarProps } from './sidebar.component';
import { GRID_BORDER_RADIUS } from '@alaarab/ogrid-core';

@Component({
  selector: 'ogrid-layout',
  standalone: true,
  imports: [CommonModule, SideBarComponent],
  template: `
    <div [class]="className() ?? ''" [style.display]="'flex'" [style.flex-direction]="'column'" [style.height]="'100%'">
      <div [style.border]="'1px solid var(--ogrid-border, #e0e0e0)'"
           [style.border-radius.px]="borderRadius"
           [style.overflow]="'hidden'"
           [style.display]="'flex'"
           [style.flex-direction]="'column'"
           [style.flex]="1"
           [style.min-height]="0"
           [style.background]="'var(--ogrid-bg, #fff)'"
      >
        <!-- Toolbar strip -->
        @if (hasToolbar()) {
          <div
            [style.display]="'flex'"
            [style.justify-content]="'space-between'"
            [style.align-items]="'center'"
            [style.padding]="'6px 12px'"
            [style.background]="'var(--ogrid-header-bg, #f5f5f5)'"
            [style.gap.px]="8"
            [style.flex-wrap]="'wrap'"
            [style.min-height]="0"
            [style.border-bottom]="hasToolbarBelow() ? 'none' : '1px solid var(--ogrid-border, #e0e0e0)'"
          >
            <div style="display:flex;align-items:center;gap:8px">
              <ng-content select="[toolbar]"></ng-content>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <ng-content select="[toolbarEnd]"></ng-content>
            </div>
          </div>
        }

        <!-- Secondary toolbar row -->
        @if (hasToolbarBelow()) {
          <div style="border-bottom:1px solid var(--ogrid-border, #e0e0e0);padding:6px 12px;background:var(--ogrid-header-bg, #f5f5f5)">
            <ng-content select="[toolbarBelow]"></ng-content>
          </div>
        }

        <!-- Grid area -->
        @if (sideBar()) {
          <div style="width:100%;min-width:0;min-height:0;flex:1;display:flex">
            @if (sideBar()?.position === 'left') {
              <ogrid-sidebar [sideBarProps]="sideBar()"></ogrid-sidebar>
            }
            <div style="flex:1;min-width:0;min-height:0;display:flex;flex-direction:column">
              <ng-content></ng-content>
            </div>
            @if (sideBar()?.position !== 'left') {
              <ogrid-sidebar [sideBarProps]="sideBar()"></ogrid-sidebar>
            }
          </div>
        } @else {
          <div style="width:100%;min-width:0;min-height:0;flex:1;display:flex;flex-direction:column">
            <ng-content></ng-content>
          </div>
        }

        <!-- Footer strip (pagination) -->
        @if (hasPagination()) {
          <div style="border-top:1px solid var(--ogrid-border, #e0e0e0);background:var(--ogrid-header-bg, #f5f5f5);padding:6px 12px">
            <ng-content select="[pagination]"></ng-content>
          </div>
        }
      </div>
    </div>
  `,
})
export class OGridLayoutComponent {
  readonly className = input<string | undefined>(undefined);
  readonly hasToolbar = input<boolean>(false);
  readonly hasToolbarBelow = input<boolean>(false);
  readonly hasPagination = input<boolean>(false);
  readonly sideBar = input<SideBarProps | null>(null);

  readonly borderRadius = GRID_BORDER_RADIUS;
}
