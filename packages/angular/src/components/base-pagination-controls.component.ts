import { computed, Input, Output, EventEmitter } from '@angular/core';
import { getPaginationViewModel } from '@alaarab/ogrid-core';

/**
 * Abstract base class containing all shared TypeScript logic for PaginationControls components.
 * Framework-specific UI packages extend this with their templates and style overrides.
 *
 * Subclasses must:
 * 1. Provide a @Component decorator with template and styles
 */
export abstract class BasePaginationControlsComponent {
  @Input({ required: true }) currentPage!: number;
  @Input({ required: true }) pageSize!: number;
  @Input({ required: true }) totalCount!: number;
  @Input() pageSizeOptions: number[] | undefined = undefined;
  @Input() entityLabelPlural: string = 'items';

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  readonly labelPlural = computed(() => this.entityLabelPlural ?? 'items');

  readonly vm = computed(() => {
    const opts = this.pageSizeOptions;
    return getPaginationViewModel(
      this.currentPage,
      this.pageSize,
      this.totalCount,
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
