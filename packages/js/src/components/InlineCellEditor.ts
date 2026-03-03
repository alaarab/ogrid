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
  private scrollCleanup: (() => void) | null = null;

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
    onAfterCommit?: () => void,
    overrideValue?: unknown
  ): void {
    this.closeEditor();
    this.editingCell = { rowId, columnId };
    this.editingCellElement = cell;
    this.onCommit = onCommit;
    this.onCancel = onCancel;
    this.onAfterCommit = onAfterCommit ?? null;

    const value = overrideValue !== undefined
      ? overrideValue
      : getCellValue(item, column as unknown as Parameters<typeof getCellValue>[1]);
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

    // Position dropdown with fixed positioning to escape container overflow
    const dropdownEl = editor.querySelector('[role="listbox"]') as HTMLElement | null;
    if (dropdownEl) {
      const maxH = 200;
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < maxH && rect.top > spaceBelow;
      dropdownEl.style.position = 'fixed';
      dropdownEl.style.left = `${rect.left}px`;
      dropdownEl.style.width = `${rect.width}px`;
      dropdownEl.style.maxHeight = `${maxH}px`;
      dropdownEl.style.zIndex = '9999';
      dropdownEl.style.right = 'auto';
      if (flipUp) {
        dropdownEl.style.top = 'auto';
        dropdownEl.style.bottom = `${window.innerHeight - rect.top}px`;
      } else {
        dropdownEl.style.top = `${rect.bottom}px`;
      }

      // Close editor on scroll so the fixed dropdown doesn't drift.
      // Delay attachment via RAF to skip spurious scroll events fired during mount
      // (e.g. focus-triggered scroll, layout-shift scroll from DOM changes).
      const scrollParent = editor.closest('[data-ogrid-scroll-container]') ?? editor.closest('[style*="overflow"]');
      const handleScroll = () => this.closeEditor();
      const raf = requestAnimationFrame(() => {
        if (scrollParent) scrollParent.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('scroll', handleScroll, { passive: true });
      });
      this.scrollCleanup = () => {
        cancelAnimationFrame(raf);
        if (scrollParent) scrollParent.removeEventListener('scroll', handleScroll);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }

  /** Returns the cell currently being edited, or null if no editor is open. */
  getEditingCell(): { rowId: RowId; columnId: string } | null {
    return this.editingCell;
  }

  closeEditor(): void {
    this.scrollCleanup?.();
    this.scrollCleanup = null;
    // Reset visibility on the cell that was being edited (Bug 1 & 2 fix:
    // the renderer sets visibility:hidden on the editing cell, and it may
    // not re-render before the next click lands, so we clear it explicitly).
    // Look up the cell by data attributes since the original element reference
    // may have been replaced by a re-render.
    if (this.editingCell && this.container.isConnected) {
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
      // Also reset the original element if it's still connected in the DOM
      if (this.editingCellElement.isConnected) {
        this.editingCellElement.style.visibility = '';
      }
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

  /**
   * Shared factory for text/date input editors — both types have identical event handling,
   * differing only in input.type and initial value formatting.
   */
  private createInputEditor(type: 'text' | 'date', initialValue: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = type;
    input.value = initialValue;
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
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        // Let the input handle cursor movement — don't bubble to grid navigation
        e.stopPropagation();
      } else if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v', 'a', 'z', 'y'].includes(e.key)) {
        // Let the input handle clipboard/undo shortcuts natively — don't bubble to grid
        e.stopPropagation();
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

  private createTextEditor(value: unknown): HTMLInputElement {
    return this.createInputEditor('text', value != null ? String(value) : '');
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
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.stopPropagation();
      }
    });

    return input;
  }

  private createDateEditor(value: unknown): HTMLInputElement {
    let initialValue = '';
    if (value != null) {
      const dateStr = String(value);
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        initialValue = dateStr.substring(0, 10);
      }
    }
    const input = this.createInputEditor('text', initialValue);
    input.placeholder = 'YYYY-MM-DD';
    return input;
  }

  private createSelectEditor(value: unknown, column: IColumnDef<T>): HTMLElement {
    const values = column.cellEditorParams?.values ?? [];
    const formatValue = column.cellEditorParams?.formatValue as ((v: unknown) => string) | undefined;
    const getDisplayText = (v: unknown): string => formatValue ? formatValue(v) : (v != null ? String(v) : '');

    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, EDITOR_STYLE);
    wrapper.style.padding = '6px 10px';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.tabIndex = 0;

    // Display current value + chevron
    const display = document.createElement('div');
    display.style.display = 'flex';
    display.style.alignItems = 'center';
    display.style.justifyContent = 'space-between';
    display.style.width = '100%';
    display.style.cursor = 'pointer';
    display.style.fontSize = '13px';

    const valueSpan = document.createElement('span');
    valueSpan.textContent = getDisplayText(value);
    display.appendChild(valueSpan);

    const chevron = document.createElement('span');
    chevron.textContent = '\u25BE';
    chevron.style.marginLeft = '4px';
    chevron.style.fontSize = '10px';
    chevron.style.opacity = '0.5';
    display.appendChild(chevron);
    wrapper.appendChild(display);

    // Dropdown list
    const dropdown = document.createElement('div');
    dropdown.setAttribute('role', 'listbox');
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.right = '0';
    dropdown.style.maxHeight = '200px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.backgroundColor = 'var(--ogrid-bg, #fff)';
    dropdown.style.border = '1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12))';
    dropdown.style.zIndex = '1001';
    dropdown.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
    dropdown.style.textAlign = 'left';
    wrapper.appendChild(dropdown);

    let highlightedIndex = Math.max(values.findIndex((v) => String(v) === String(value)), 0);

    // Build all option elements once
    const buildOptions = () => {
      dropdown.innerHTML = '';
      for (let i = 0; i < values.length; i++) {
        const val = values[i];
        const option = document.createElement('div');
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(i === highlightedIndex));
        option.textContent = getDisplayText(val);
        option.style.padding = '6px 8px';
        option.style.cursor = 'pointer';
        option.style.color = 'var(--ogrid-fg, #242424)';
        if (i === highlightedIndex) {
          option.style.background = 'var(--ogrid-bg-hover, #e8f0fe)';
        }
        option.addEventListener('mousedown', (e) => {
          e.preventDefault();
          if (this.editingCell) {
            this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, val);
          }
          this.closeEditor();
        });
        dropdown.appendChild(option);
      }
    };

    // Only update CSS class on old/new highlighted item — avoids rebuilding the DOM
    const updateHighlight = (prevIndex: number, nextIndex: number) => {
      const prev = dropdown.children[prevIndex] as HTMLElement | undefined;
      const next = dropdown.children[nextIndex] as HTMLElement | undefined;
      if (prev) {
        prev.style.background = '';
        prev.setAttribute('aria-selected', 'false');
      }
      if (next) {
        next.style.background = 'var(--ogrid-bg-hover, #e8f0fe)';
        next.setAttribute('aria-selected', 'true');
      }
    };

    const scrollHighlightedIntoView = () => {
      const highlighted = dropdown.children[highlightedIndex] as HTMLElement | undefined;
      highlighted?.scrollIntoView({ block: 'nearest' });
    };

    buildOptions();

    wrapper.addEventListener('keydown', (e) => {
      e.stopPropagation(); // Prevent grid navigation while select editor is open
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const prevDown = highlightedIndex;
          highlightedIndex = Math.min(highlightedIndex + 1, values.length - 1);
          updateHighlight(prevDown, highlightedIndex);
          scrollHighlightedIntoView();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevUp = highlightedIndex;
          highlightedIndex = Math.max(highlightedIndex - 1, 0);
          updateHighlight(prevUp, highlightedIndex);
          scrollHighlightedIntoView();
          break;
        }
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (values.length > 0 && highlightedIndex < values.length) {
            if (this.editingCell) {
              this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, values[highlightedIndex]);
            }
            const afterCommit = this.onAfterCommit;
            this.closeEditor();
            afterCommit?.();
          }
          break;
        case 'Tab':
          e.preventDefault();
          if (values.length > 0 && highlightedIndex < values.length) {
            if (this.editingCell) {
              this.onCommit?.(this.editingCell.rowId, this.editingCell.columnId, values[highlightedIndex]);
            }
            this.closeEditor();
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          this.onCancel?.();
          this.closeEditor();
          break;
      }
    });

    return wrapper;
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
    dropdown.style.textAlign = 'left';
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
        }, { passive: true });
        option.addEventListener('mouseleave', () => {
          option.style.backgroundColor = 'var(--ogrid-bg, #fff)';
        }, { passive: true });
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
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        // Let the input handle cursor movement — don't bubble to grid navigation
        e.stopPropagation();
      } else if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v', 'a', 'z', 'y'].includes(e.key)) {
        // Let the input handle clipboard/undo shortcuts natively — don't bubble to grid
        e.stopPropagation();
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
