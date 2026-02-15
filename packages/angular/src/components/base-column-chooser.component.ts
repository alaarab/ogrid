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
  private readonly _columns = signal<IColumnDefinition[]>([]);
  private readonly _visibleColumns = signal<Set<string>>(new Set());

  @Input({ required: true })
  set columns(v: IColumnDefinition[]) { this._columns.set(v); }
  get columns(): IColumnDefinition[] { return this._columns(); }

  @Input({ required: true })
  set visibleColumns(v: Set<string>) { this._visibleColumns.set(v); }
  get visibleColumns(): Set<string> { return this._visibleColumns(); }

  @Output() visibilityChange = new EventEmitter<{ columnKey: string; visible: boolean }>();

  // Dropdown state
  readonly isOpen = signal(false);

  // Computed counts (signal-backed so computed() tracks changes)
  readonly visibleCount = computed(() => this._visibleColumns().size);
  readonly totalCount = computed(() => this._columns().length);

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
