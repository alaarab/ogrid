import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, DestroyRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { GRID_CONTEXT_MENU_ITEMS, formatShortcut } from '@alaarab/ogrid-core';

@Component({
  selector: 'ogrid-context-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #menuRef
      [class]="classNames?.contextMenu ?? ''"
      role="menu"
      [style.left.px]="x"
      [style.top.px]="y"
      aria-label="Grid context menu"
    >
      @for (item of menuItems; track item.id) {
        @if (item.dividerBefore) {
          <div [class]="classNames?.contextMenuDivider ?? ''"></div>
        }
        <button
          type="button"
          [class]="classNames?.contextMenuItem ?? ''"
          (click)="onItemClick(item.id)"
          [disabled]="isDisabled(item)"
        >
          <span [class]="classNames?.contextMenuItemLabel ?? ''">{{ item.label }}</span>
          @if (item.shortcut) {
            <span [class]="classNames?.contextMenuItemShortcut ?? ''">
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

  @Input({ required: true }) x!: number;
  @Input({ required: true }) y!: number;
  @Input() hasSelection: boolean = false;
  @Input() canUndoProp: boolean = false;
  @Input() canRedoProp: boolean = false;

  @Input() classNames: {
    contextMenu?: string;
    contextMenuItem?: string;
    contextMenuItemLabel?: string;
    contextMenuItemShortcut?: string;
    contextMenuDivider?: string;
  } | undefined = undefined;

  @Output() copy = new EventEmitter<void>();
  @Output() cut = new EventEmitter<void>();
  @Output() paste = new EventEmitter<void>();
  @Output() selectAll = new EventEmitter<void>();
  @Output() undoAction = new EventEmitter<void>();
  @Output() redoAction = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('menuRef') menuRef?: ElementRef<HTMLDivElement>;

  readonly menuItems = GRID_CONTEXT_MENU_ITEMS;
  readonly formatShortcutFn = formatShortcut;

  private clickOutsideHandler = (e: MouseEvent) => {
    const el = this.menuRef?.nativeElement;
    if (el && !el.contains(e.target as Node)) this.close.emit();
  };

  private keyDownHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close.emit();
  };

  constructor() {
    // Register listeners once on init (no signal dependencies needed)
    document.addEventListener('mousedown', this.clickOutsideHandler, true);
    document.addEventListener('keydown', this.keyDownHandler, true);

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('mousedown', this.clickOutsideHandler, true);
      document.removeEventListener('keydown', this.keyDownHandler, true);
    });
  }

  isDisabled(item: (typeof GRID_CONTEXT_MENU_ITEMS)[number]): boolean {
    if (item.disabledWhenNoSelection && !this.hasSelection) return true;
    if (item.id === 'undo' && !this.canUndoProp) return true;
    if (item.id === 'redo' && !this.canRedoProp) return true;
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
