import { signal, computed, Input, Output, EventEmitter } from '@angular/core';
import type { IColumnDefinition } from '../types';

export interface IColumnChooserProps {
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, visible: boolean) => void;
}

/**
 * Abstract base class containing all shared TypeScript logic for ColumnChooser components.
 * Framework-specific UI packages extend this with their templates and style overrides.
 *
 * Subclasses must:
 * 1. Provide a @Component decorator with template and styles
 * 2. Handle their own click-outside behavior (host binding or effect)
 */
export abstract class BaseColumnChooserComponent {
  @Input({ required: true }) columns!: IColumnDefinition[];
  @Input({ required: true }) visibleColumns!: Set<string>;

  @Output() visibilityChange = new EventEmitter<{ columnKey: string; visible: boolean }>();

  // Dropdown state
  readonly isOpen = signal(false);

  // Computed counts
  readonly visibleCount = computed(() => this.visibleColumns.size);
  readonly totalCount = computed(() => this.columns.length);

  toggle(): void {
    this.isOpen.update((v) => !v);
  }

  onCheckboxChange(columnKey: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.visibilityChange.emit({ columnKey, visible: checked });
  }

  onToggle(columnKey: string, checked: boolean): void {
    this.visibilityChange.emit({ columnKey, visible: checked });
  }

  selectAll(): void {
    for (const col of this.columns) {
      if (!this.visibleColumns.has(col.columnId)) {
        this.visibilityChange.emit({ columnKey: col.columnId, visible: true });
      }
    }
  }

  clearAll(): void {
    for (const col of this.columns) {
      if (this.visibleColumns.has(col.columnId)) {
        this.visibilityChange.emit({ columnKey: col.columnId, visible: false });
      }
    }
  }

  onClearAll(): void {
    for (const col of this.columns) {
      if (col.required !== true && this.visibleColumns.has(col.columnId)) {
        this.visibilityChange.emit({ columnKey: col.columnId, visible: false });
      }
    }
  }

  onSelectAll(): void {
    for (const col of this.columns) {
      if (!this.visibleColumns.has(col.columnId)) {
        this.visibilityChange.emit({ columnKey: col.columnId, visible: true });
      }
    }
  }
}
