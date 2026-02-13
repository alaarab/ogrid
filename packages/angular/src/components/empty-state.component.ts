import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ogrid-empty-state',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .ogrid-empty-state-clear-btn {
      background: none; border: none; color: inherit;
      text-decoration: underline; cursor: pointer; padding: 0; font: inherit;
    }
  `],
  template: `
    @if (render) {
      <ng-container [ngTemplateOutlet]="render"></ng-container>
    } @else if (message) {
      {{ message }}
    } @else if (hasActiveFilters) {
      No items match your current filters. Try adjusting your search or
      <button type="button" (click)="clearAll.emit()" class="ogrid-empty-state-clear-btn">
        clear all filters
      </button>
      to see all items.
    } @else {
      There are no items available at this time.
    }
  `,
})
export class EmptyStateComponent {
  @Input() message: string | undefined = undefined;
  @Input() hasActiveFilters: boolean = false;
  @Input() render: unknown = undefined;
  @Output() clearAll = new EventEmitter<void>();
}
