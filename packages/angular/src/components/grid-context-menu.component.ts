import { Component, input, output, ElementRef, effect, viewChild, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GRID_CONTEXT_MENU_ITEMS, getContextMenuHandlers, formatShortcut } from '@alaarab/ogrid-core';

@Component({
  selector: 'ogrid-context-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      #menuRef
      [class]="classNames()?.contextMenu ?? ''"
      role="menu"
      [style.left.px]="x()"
      [style.top.px]="y()"
      aria-label="Grid context menu"
    >
      @for (item of menuItems; track item.id) {
        @if (item.dividerBefore) {
          <div [class]="classNames()?.contextMenuDivider ?? ''"></div>
        }
        <button
          type="button"
          [class]="classNames()?.contextMenuItem ?? ''"
          (click)="onItemClick(item.id)"
          [disabled]="isDisabled(item)"
        >
          <span [class]="classNames()?.contextMenuItemLabel ?? ''">{{ item.label }}</span>
          @if (item.shortcut) {
            <span [class]="classNames()?.contextMenuItemShortcut ?? ''">
              {{ formatShortcutFn(item.shortcut) }}
            </span>
          }
        </button>
      }
    </div>
  `,
})
export class GridContextMenuComponent {
  private destroyRef = inject(DestroyRef);

  readonly x = input.required<number>();
  readonly y = input.required<number>();
  readonly hasSelection = input<boolean>(false);
  readonly canUndoProp = input<boolean>(false);
  readonly canRedoProp = input<boolean>(false);

  readonly classNames = input<{
    contextMenu?: string;
    contextMenuItem?: string;
    contextMenuItemLabel?: string;
    contextMenuItemShortcut?: string;
    contextMenuDivider?: string;
  } | undefined>(undefined);

  readonly copy = output<void>();
  readonly cut = output<void>();
  readonly paste = output<void>();
  readonly selectAll = output<void>();
  readonly undoAction = output<void>();
  readonly redoAction = output<void>();
  readonly close = output<void>();

  readonly menuRef = viewChild<ElementRef<HTMLDivElement>>('menuRef');

  readonly menuItems = GRID_CONTEXT_MENU_ITEMS;
  readonly formatShortcutFn = formatShortcut;

  private clickOutsideHandler = (e: MouseEvent) => {
    const el = this.menuRef()?.nativeElement;
    if (el && !el.contains(e.target as Node)) this.close.emit();
  };

  private keyDownHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close.emit();
  };

  constructor() {
    effect(() => {
      // Re-register listeners when component renders
      document.addEventListener('mousedown', this.clickOutsideHandler, true);
      document.addEventListener('keydown', this.keyDownHandler, true);
    });

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('mousedown', this.clickOutsideHandler, true);
      document.removeEventListener('keydown', this.keyDownHandler, true);
    });
  }

  isDisabled(item: (typeof GRID_CONTEXT_MENU_ITEMS)[number]): boolean {
    if (item.disabledWhenNoSelection && !this.hasSelection()) return true;
    if (item.id === 'undo' && !this.canUndoProp()) return true;
    if (item.id === 'redo' && !this.canRedoProp()) return true;
    return false;
  }

  onItemClick(id: string): void {
    switch (id) {
      case 'copy': this.copy.emit(); break;
      case 'cut': this.cut.emit(); break;
      case 'paste': this.paste.emit(); break;
      case 'selectAll': this.selectAll.emit(); break;
      case 'undo': this.undoAction.emit(); break;
      case 'redo': this.redoAction.emit(); break;
    }
    this.close.emit();
  }
}
