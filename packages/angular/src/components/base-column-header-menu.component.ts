import { Directive, signal, computed, Input } from '@angular/core';
import {
  getColumnHeaderMenuItems,
  type IColumnHeaderMenuItem,
  type ColumnHeaderMenuHandlers,
} from '@alaarab/ogrid-core';

/**
 * Abstract base class containing all shared TypeScript logic for ColumnHeaderMenu components.
 * Framework-specific UI packages extend this with their templates and style overrides.
 *
 * Uses signal-backed @Input setters so that computed() tracks input changes reactively
 * (plain @Input properties are not reactive in Angular signals).
 *
 * Subclasses must:
 * 1. Provide a @Component decorator with template and styles
 * 2. Implement their own menu open/close mechanism (mat-menu, p-menu, or native dropdown)
 */
@Directive()
export abstract class BaseColumnHeaderMenuComponent {
  @Input({ required: true }) columnId!: string;

  // Signal-backed inputs so computed() tracks changes reactively
  private readonly _canPinLeft = signal(true);
  private readonly _canPinRight = signal(true);
  private readonly _canUnpin = signal(false);
  private readonly _currentSort = signal<'asc' | 'desc' | null>(null);
  private readonly _isSortable = signal(true);
  private readonly _isResizable = signal(true);

  @Input() set canPinLeft(v: boolean) { this._canPinLeft.set(v); }
  @Input() set canPinRight(v: boolean) { this._canPinRight.set(v); }
  @Input() set canUnpin(v: boolean) { this._canUnpin.set(v); }
  @Input() set currentSort(v: 'asc' | 'desc' | null) { this._currentSort.set(v); }
  @Input() set isSortable(v: boolean) { this._isSortable.set(v); }
  @Input() set isResizable(v: boolean) { this._isResizable.set(v); }

  @Input() handlers: Partial<ColumnHeaderMenuHandlers> = {};

  readonly menuItems = computed<IColumnHeaderMenuItem[]>(() =>
    getColumnHeaderMenuItems({
      canPinLeft: this._canPinLeft(),
      canPinRight: this._canPinRight(),
      canUnpin: this._canUnpin(),
      currentSort: this._currentSort(),
      isSortable: this._isSortable(),
      isResizable: this._isResizable(),
    })
  );

  handleMenuItemClick(itemId: string): void {
    const h = this.handlers;
    const actionMap: Record<string, (() => void) | undefined> = {
      pinLeft: h.onPinLeft,
      pinRight: h.onPinRight,
      unpin: h.onUnpin,
      sortAsc: h.onSortAsc,
      sortDesc: h.onSortDesc,
      clearSort: h.onClearSort,
      autosizeThis: h.onAutosizeThis,
      autosizeAll: h.onAutosizeAll,
    };
    const action = actionMap[itemId];
    if (action) {
      action();
      h.onClose?.();
    }
  }
}
