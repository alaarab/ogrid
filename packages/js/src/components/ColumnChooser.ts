import type { GridState } from '../state/GridState';

export class ColumnChooser<T> {
  private container: HTMLElement;
  private state: GridState<T>;
  private el: HTMLElement | null = null;
  private dropdown: HTMLElement | null = null;
  private isOpen = false;
  private initialized = false;

  constructor(container: HTMLElement, state: GridState<T>) {
    this.container = container;
    this.state = state;
  }

  render(): void {
    if (!this.initialized) {
      this.createDOM();
      this.initialized = true;
    }
    // If dropdown is open, update checkbox states without destroying/recreating
    if (this.isOpen && this.dropdown) {
      this.updateDropdownState();
    }
  }

  /** Initial DOM creation — called once. */
  private createDOM(): void {
    this.el = document.createElement('div');
    this.el.className = 'ogrid-column-chooser';

    const btn = document.createElement('button');
    btn.className = 'ogrid-column-chooser-btn';
    btn.textContent = 'Columns';
    btn.addEventListener('click', () => this.toggle());
    this.el.appendChild(btn);

    this.container.appendChild(this.el);
  }

  /** Update checkbox checked states without destroying the dropdown. */
  private updateDropdownState(): void {
    if (!this.dropdown) return;
    const checkboxes = this.dropdown.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const columns = this.state.columns;
    checkboxes.forEach((checkbox, idx) => {
      if (idx < columns.length) {
        checkbox.checked = this.state.visibleColumns.has(columns[idx].columnId);
      }
    });
  }

  private toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private open(): void {
    if (this.dropdown) return;
    this.isOpen = true;

    this.dropdown = document.createElement('div');
    this.dropdown.className = 'ogrid-column-chooser-dropdown';

    for (const col of this.state.columns) {
      const label = document.createElement('label');
      label.className = 'ogrid-column-chooser-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.state.visibleColumns.has(col.columnId);
      checkbox.disabled = !!col.required;
      checkbox.addEventListener('change', () => {
        const next = new Set(this.state.visibleColumns);
        if (checkbox.checked) {
          next.add(col.columnId);
        } else {
          next.delete(col.columnId);
        }
        this.state.setVisibleColumns(next);
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' ' + col.name));
      this.dropdown.appendChild(label);
    }

    this.el?.appendChild(this.dropdown);
  }

  private close(): void {
    this.isOpen = false;
    this.dropdown?.remove();
    this.dropdown = null;
  }

  destroy(): void {
    this.close();
    this.el?.remove();
    this.el = null;
    this.initialized = false;
  }
}
