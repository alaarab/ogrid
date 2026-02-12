import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ogrid-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (render()) {
      <ng-container [ngTemplateOutlet]="render()!"></ng-container>
    } @else if (message()) {
      {{ message() }}
    } @else if (hasActiveFilters()) {
      No items match your current filters. Try adjusting your search or
      <button type="button" (click)="clearAll.emit()" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit">
        clear all filters
      </button>
      to see all items.
    } @else {
      There are no items available at this time.
    }
  `,
})
export class EmptyStateComponent {
  readonly message = input<string | undefined>(undefined);
  readonly hasActiveFilters = input<boolean>(false);
  readonly render = input<unknown>(undefined);
  readonly clearAll = output<void>();
}
