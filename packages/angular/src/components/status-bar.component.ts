import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getStatusBarParts } from '@alaarab/ogrid-core';

@Component({
  selector: 'ogrid-status-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="classNames()?.statusBar ?? ''" role="status" aria-live="polite">
      @for (part of parts(); track part.key) {
        <span [class]="classNames()?.statusBarItem ?? ''">
          <span [class]="classNames()?.statusBarLabel ?? ''">{{ part.label }}</span>
          <span [class]="classNames()?.statusBarValue ?? ''">{{ part.value.toLocaleString() }}</span>
        </span>
      }
    </div>
  `,
})
export class StatusBarComponent {
  readonly totalCount = input.required<number>();
  readonly filteredCount = input<number | undefined>(undefined);
  readonly selectedCount = input<number | undefined>(undefined);
  readonly selectedCellCount = input<number | undefined>(undefined);
  readonly aggregation = input<{
    sum: number;
    avg: number;
    min: number;
    max: number;
    count: number;
  } | null | undefined>(undefined);
  readonly suppressRowCount = input<boolean | undefined>(undefined);
  readonly classNames = input<{
    statusBar?: string;
    statusBarItem?: string;
    statusBarLabel?: string;
    statusBarValue?: string;
  } | undefined>(undefined);

  protected readonly parts = () => {
    return getStatusBarParts({
      totalCount: this.totalCount(),
      filteredCount: this.filteredCount(),
      selectedCount: this.selectedCount(),
      selectedCellCount: this.selectedCellCount(),
      aggregation: this.aggregation() ?? undefined,
      suppressRowCount: this.suppressRowCount(),
    });
  };
}
