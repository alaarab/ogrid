import type { IColumnDef, ICellEditorContext } from '../types/columnTypes';
import type { RowId } from '@alaarab/ogrid-core';
import { getCellValue } from '@alaarab/ogrid-core';

const EDITOR_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  zIndex: '1000',
  boxSizing: 'border-box',
  border: '2px solid var(--ogrid-selection, #217346)',
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
  outline: 'none',
  fontFamily: 'inherit',
  fontSize: 'inherit',
};

export class InlineCellEditor<T> {
  private container: HTMLElement;
  private editor: HTMLElement | null = null;
  private editingCell: { rowId: RowId; columnId: string } | null = null;
  private editingCellElement: HTMLTableCellElement | null = null;
  private onCommit: ((rowId: RowId, columnId: string, value: unknown) => void) | null = null;
  private onCancel: (() => void) | null = null;
  private onAfterCommit: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  startEdit(
    rowId: RowId,
    columnId: string,
    item: T,
    column: IColumnDef<T>,
    cell: HTMLTableCellElement,
    onCommit: (rowId: RowId, columnId: string, value: unknown) => void,
    onCancel: () => void,
    onAfterCommit?: () => void
  ): void {
    this.closeEditor();
    this.editingCell = { rowId, columnId };
    this.editingCellElement = cell;
    this.onCommit = onCommit;
    this.onCancel = onCancel;
    this.onAfterCommit = onAfterCommit ?? null;

    const value = getCellValue(item, column as unknown as Parameters<typeof getCellValue>[1]);
    const rect = cell.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    const editor = this.createEditor(column, item, value, cell);
    editor.style.position = 'absolute';
    editor.style.left = `${rect.left - containerRect.left + this.container.scrollLeft}px`;
    editor.style.top = `${rect.top - containerRect.top + this.container.scrollTop}px`;
    editor.style.width = `${rect.width}px`;
    editor.style.height = `${rect.height}px`;

    this.editor = editor;
    this.container.appendChild(editor);
    editor.focus();
  }

  /** Returns the cell currently being edited, or null if no editor is open. */
  getEditingCell(): { rowId: RowId; columnId: string } | null {
    return this.editingCell;
  }

  closeEditor(): void {
    // Reset visibility on the cell that was being edited (Bug 1 & 2 fix:
    // the renderer sets visibility:hidden on the editing cell, and it may
    // not re-render before the next click lands, so we clear it explicitly).
    // Look up the cell by data attributes since the original element reference
    // may have been replaced by a re-render.
    if (this.editingCell) {
      const { rowId, columnId } = this.editingCell;
      const row = this.container.querySelector(`tr[data-row-id="${rowId}"]`);
      if (row) {
        const td = row.querySelector(`td[data-column-id="${columnId}"]`) as HTMLElement | null;
        if (td) {
          td.style.visibility = '';
        }
      }
    }
    if (this.editingCellElement) {
      // Also reset the original element in case it's still in the DOM
      this.editingCellElement.style.visibility = '';
      this.editingCellElement = null;
    }
    if (this.editor) {
      this.editor.remove();
      this.editor = null;
    }
    this.editingCell = null;
    this.onCommit = null;
    this.onCancel = null;
    this.onAfterCommit = null;
  }

  private createEditor(
    column: IColumnDef<T>,
    item: T,
    value: unknown,
    cell: HTMLTableCellElement
  ): HTMLElement {
    const editorType = column.cellEditor;

    if (typeof editorType === 'function') {
      const context: ICellEditorContext<T> = {
        value,
        onValueChange: (newValue) => {
          if (this.editingCell) {
            this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, newValue);
          }
        },
        onCommit: () => this.closeEditor(),
        onCancel: () => {
          this.onCancel?.();
          this.closeEditor();
        },
        item,
        column,
        cell,
        cellEditorParams: column.cellEditorParams,
      };
      return editorType(context);
    }

    // Built-in editor types
    if (editorType === 'checkbox' || column.type === 'boolean') {
      return this.createCheckboxEditor(value);
    }

    if (editorType === 'select') {
      return this.createSelectEditor(value, column);
    }

    if (editorType === 'richSelect') {
      return this.createRichSelectEditor(value, column);
    }

    if (editorType === 'date' || column.type === 'date') {
      return this.createDateEditor(value);
    }

    // Default: text editor
    return this.createTextEditor(value);
  }

  private createTextEditor(value: unknown): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value != null ? String(value) : '';
    Object.assign(input.style, EDITOR_STYLE);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation(); // Prevent grid wrapper from re-opening the editor
        if (this.editingCell) {
          this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, input.value);
        }
        const afterCommit = this.onAfterCommit;
        this.closeEditor();
        afterCommit?.(); // Move active cell down after closing
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.onCancel?.();
        this.closeEditor();
      }
    });

    input.addEventListener('blur', () => {
      if (this.editingCell) {
        this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, input.value);
      }
      this.closeEditor();
    });

    setTimeout(() => input.select(), 0);
    return input;
  }

  private createCheckboxEditor(value: unknown): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(value);
    Object.assign(input.style, EDITOR_STYLE);
    input.style.width = '20px';
    input.style.height = '20px';

    input.addEventListener('change', () => {
      if (this.editingCell) {
        this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, input.checked);
      }
      this.closeEditor();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.onCancel?.();
        this.closeEditor();
      }
    });

    return input;
  }

  private createDateEditor(value: unknown): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'date';
    if (value != null) {
      const dateStr = String(value);
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        input.value = dateStr.substring(0, 10);
      }
    }
    Object.assign(input.style, EDITOR_STYLE);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation(); // Prevent grid wrapper from re-opening the editor
        if (this.editingCell) {
          this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, input.value);
        }
        const afterCommit = this.onAfterCommit;
        this.closeEditor();
        afterCommit?.(); // Move active cell down after closing
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.onCancel?.();
        this.closeEditor();
      }
    });

    input.addEventListener('blur', () => {
      if (this.editingCell) {
        this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, input.value);
      }
      this.closeEditor();
    });

    setTimeout(() => input.select(), 0);
    return input;
  }

  private createSelectEditor(value: unknown, column: IColumnDef<T>): HTMLSelectElement {
    const select = document.createElement('select');
    const values = column.cellEditorParams?.values ?? [];
    for (const val of values) {
      const option = document.createElement('option');
      option.value = String(val);
      option.textContent = String(val);
      select.appendChild(option);
    }
    select.value = value != null ? String(value) : '';
    Object.assign(select.style, EDITOR_STYLE);

    select.addEventListener('change', () => {
      if (this.editingCell) {
        this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, select.value);
      }
      this.closeEditor();
    });

    select.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.onCancel?.();
        this.closeEditor();
      }
    });

    return select;
  }

  private createRichSelectEditor(value: unknown, column: IColumnDef<T>): HTMLElement {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, EDITOR_STYLE);
    wrapper.style.padding = '0';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value != null ? String(value) : '';
    input.style.width = '100%';
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.padding = '4px';
    input.style.boxSizing = 'border-box';
    input.style.background = 'var(--ogrid-bg, #fff)';
    input.style.color = 'var(--ogrid-fg, rgba(0, 0, 0, 0.87))';
    wrapper.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.width = '100%';
    dropdown.style.maxHeight = '200px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.backgroundColor = 'var(--ogrid-bg, #fff)';
    dropdown.style.border = '1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12))';
    dropdown.style.zIndex = '1001';
    wrapper.appendChild(dropdown);

    const values = column.cellEditorParams?.values ?? [];
    const formatValue = column.cellEditorParams?.formatValue ?? ((v: unknown) => String(v));

    const renderOptions = (filter: string) => {
      dropdown.innerHTML = '';
      const filtered = values.filter((v) =>
        String(formatValue(v)).toLowerCase().includes(filter.toLowerCase())
      );
      for (const val of filtered) {
        const option = document.createElement('div');
        option.textContent = String(formatValue(val));
        option.style.padding = '4px 8px';
        option.style.cursor = 'pointer';
        option.addEventListener('mousedown', (e) => {
          e.preventDefault();
          if (this.editingCell) {
            this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, val);
          }
          this.closeEditor();
        });
        option.addEventListener('mouseenter', () => {
          option.style.backgroundColor = 'var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04))';
        });
        option.addEventListener('mouseleave', () => {
          option.style.backgroundColor = 'var(--ogrid-bg, #fff)';
        });
        dropdown.appendChild(option);
      }
    };

    input.addEventListener('input', () => {
      renderOptions(input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation(); // Prevent grid wrapper from re-opening the editor
        if (this.editingCell) {
          this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, input.value);
        }
        const afterCommit = this.onAfterCommit;
        this.closeEditor();
        afterCommit?.(); // Move active cell down after closing
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.onCancel?.();
        this.closeEditor();
      }
    });

    input.addEventListener('blur', (e: FocusEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (related && this.editor?.contains(related)) {
        return; // Focus moved within the editor (e.g., to dropdown), don't close
      }
      if (this.editingCell) {
        this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, input.value);
      }
      this.closeEditor();
    });

    renderOptions('');
    setTimeout(() => input.select(), 0);

    return wrapper;
  }

  destroy(): void {
    this.closeEditor();
  }
}
