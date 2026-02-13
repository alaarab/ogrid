import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getStatusBarParts } from '@alaarab/ogrid-core';

@Component({
  selector: 'ogrid-status-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="classNames?.statusBar ?? ''" role="status" aria-live="polite">
      @for (part of getParts(); track part.key) {
        <span [class]="classNames?.statusBarItem ?? ''">
          <span [class]="classNames?.statusBarLabel ?? ''">{{ part.label }}</span>
          <span [class]="classNames?.statusBarValue ?? ''">{{ part.value.toLocaleString() }}</span>
        </span>
      }
    </div>
  `,
})
export class StatusBarComponent {
  @Input({ required: true }) totalCount!: number;
  @Input() filteredCount: number | undefined = undefined;
  @Input() selectedCount: number | undefined = undefined;
  @Input() selectedCellCount: number | undefined = undefined;
  @Input() aggregation: {
    sum: number;
    avg: number;
    min: number;
    max: number;
    count: number;
  } | null | undefined = undefined;
  @Input() suppressRowCount: boolean | undefined = undefined;
  @Input() classNames: {
    statusBar?: string;
    statusBarItem?: string;
    statusBarLabel?: string;
    statusBarValue?: string;
  } | undefined = undefined;

  getParts() {
    return getStatusBarParts({
      totalCount: this.totalCount,
      filteredCount: this.filteredCount,
      selectedCount: this.selectedCount,
      selectedCellCount: this.selectedCellCount,
      aggregation: this.aggregation ?? undefined,
      suppressRowCount: this.suppressRowCount,
    });
  }
}
