import type { IColumnDef, ICellEditorContext } from '../types/columnTypes';
import type { RowId } from '@alaarab/ogrid-core';
import { getCellValue } from '@alaarab/ogrid-core';

const EDITOR_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  zIndex: '1000',
  boxSizing: 'border-box',
  border: '2px solid #0078d4',
  outline: 'none',
  fontFamily: 'inherit',
  fontSize: 'inherit',
};

export class InlineCellEditor<T> {
  private container: HTMLElement;
  private editor: HTMLElement | null = null;
  private editingCell: { rowId: RowId; columnId: string } | null = null;
  private onCommit: ((rowId: RowId, columnId: string, value: unknown) => void) | null = null;
  private onCancel: (() => void) | null = null;

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
    onCancel: () => void
  ): void {
    this.closeEditor();
    this.editingCell = { rowId, columnId };
    this.onCommit = onCommit;
    this.onCancel = onCancel;

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

  closeEditor(): void {
    if (this.editor) {
      this.editor.remove();
      this.editor = null;
    }
    this.editingCell = null;
    this.onCommit = null;
    this.onCancel = null;
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
        if (this.editingCell) {
          this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, input.value);
        }
        this.closeEditor();
      } else if (e.key === 'Escape') {
        e.preventDefault();
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
        if (this.editingCell) {
          this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, input.value);
        }
        this.closeEditor();
      } else if (e.key === 'Escape') {
        e.preventDefault();
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
    wrapper.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.width = '100%';
    dropdown.style.maxHeight = '200px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.backgroundColor = 'white';
    dropdown.style.border = '1px solid #ccc';
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
          option.style.backgroundColor = '#f0f0f0';
        });
        option.addEventListener('mouseleave', () => {
          option.style.backgroundColor = 'white';
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
        if (this.editingCell) {
          this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, input.value);
        }
        this.closeEditor();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.onCancel?.();
        this.closeEditor();
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (this.editingCell) {
          this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, input.value);
        }
        this.closeEditor();
      }, 200);
    });

    renderOptions('');
    setTimeout(() => input.select(), 0);

    return wrapper;
  }

  destroy(): void {
    this.closeEditor();
  }
}
