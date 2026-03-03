import { signal, computed, Input, Output, EventEmitter } from '@angular/core';
import { getPaginationViewModel } from '@alaarab/ogrid-core';

/**
 * Abstract base class containing all shared TypeScript logic for PaginationControls components.
 * Framework-specific UI packages extend this with their templates and style overrides.
 *
 * Subclasses must:
 * 1. Provide a @Component decorator with template and styles
 *
 * Uses @Input setter + signal pattern so computed() can track dependencies.
 * (Plain @Input properties are NOT tracked by computed()  -  only signals are.)
 */
export abstract class BasePaginationControlsComponent {
  private readonly _currentPage = signal(1);
  private readonly _pageSize = signal(25);
  private readonly _totalCount = signal(0);
  private readonly _pageSizeOptions = signal<number[] | undefined>(undefined);
  private readonly _entityLabelPlural = signal('items');

  @Input({ required: true })
  set currentPage(v: number) { this._currentPage.set(v); }
  get currentPage(): number { return this._currentPage(); }

  @Input({ required: true })
  set pageSize(v: number) { this._pageSize.set(v); }
  get pageSize(): number { return this._pageSize(); }

  @Input({ required: true })
  set totalCount(v: number) { this._totalCount.set(v); }
  get totalCount(): number { return this._totalCount(); }

  @Input()
  set pageSizeOptions(v: number[] | undefined) { this._pageSizeOptions.set(v); }
  get pageSizeOptions(): number[] | undefined { return this._pageSizeOptions(); }

  @Input()
  set entityLabelPlural(v: string) { this._entityLabelPlural.set(v); }
  get entityLabelPlural(): string { return this._entityLabelPlural(); }

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  readonly labelPlural = computed(() => this._entityLabelPlural() ?? 'items');

  readonly vm = computed(() => {
    const opts = this._pageSizeOptions();
    return getPaginationViewModel(
      this._currentPage(),
      this._pageSize(),
      this._totalCount(),
      opts ? { pageSizeOptions: opts } : undefined,
    );
  });

  onPageSizeSelect(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.pageSizeChange.emit(value);
  }

  onPageSizeChange(value: string): void {
    this.pageSizeChange.emit(Number(value));
  }
}
