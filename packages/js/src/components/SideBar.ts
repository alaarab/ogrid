import type { IColumnDefinition, SideBarPanelId, IFilters, FilterValue } from '@alaarab/ogrid-core';
import type { SideBarState } from '../state/SideBarState';

export interface SideBarFilterColumn {
  columnId: string;
  name: string;
  filterField: string;
  filterType: 'text' | 'multiSelect' | 'people' | 'date';
}

export interface SideBarRenderConfig {
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, visible: boolean) => void;
  onSetVisibleColumns: (columns: Set<string>) => void;
  filterableColumns: SideBarFilterColumn[];
  filters: IFilters;
  onFilterChange: (key: string, value: FilterValue | undefined) => void;
  filterOptions: Record<string, string[]>;
}

const PANEL_WIDTH = 240;
const TAB_WIDTH = 36;

const PANEL_LABELS: Record<SideBarPanelId, string> = {
  columns: 'Columns',
  filters: 'Filters',
};

const PANEL_ICONS: Record<SideBarPanelId, string> = {
  columns: '\u2261',
  filters: '\u2A65',
};

export class SideBar {
  private container: HTMLElement;
  private state: SideBarState;
  private el: HTMLElement | null = null;
  private config: SideBarRenderConfig | null = null;

  constructor(container: HTMLElement, state: SideBarState) {
    this.container = container;
    this.state = state;
  }

  setConfig(config: SideBarRenderConfig): void {
    this.config = config;
  }

  render(): void {
    if (this.el) this.el.remove();
    if (!this.state.isEnabled || !this.config) return;

    this.el = document.createElement('div');
    this.el.className = 'ogrid-sidebar';
    this.el.setAttribute('role', 'complementary');
    this.el.setAttribute('aria-label', 'Side bar');
    this.el.style.display = 'flex';
    this.el.style.flexDirection = 'row';
    this.el.style.flexShrink = '0';

    const position = this.state.position;
    const tabStrip = this.createTabStrip(position);
    const panel = this.createPanel(position);

    if (position === 'left') {
      this.el.appendChild(tabStrip);
      if (panel) this.el.appendChild(panel);
    } else {
      if (panel) this.el.appendChild(panel);
      this.el.appendChild(tabStrip);
    }

    this.container.appendChild(this.el);
  }

  private createTabStrip(position: 'left' | 'right'): HTMLElement {
    const strip = document.createElement('div');
    strip.style.display = 'flex';
    strip.style.flexDirection = 'column';
    strip.style.width = `${TAB_WIDTH}px`;
    strip.style.background = 'var(--ogrid-header-bg, #f5f5f5)';
    strip.setAttribute('role', 'tablist');
    strip.setAttribute('aria-label', 'Side bar tabs');

    if (position === 'right') {
      strip.style.borderLeft = '1px solid var(--ogrid-border, #e0e0e0)';
    } else {
      strip.style.borderRight = '1px solid var(--ogrid-border, #e0e0e0)';
    }

    for (const panelId of this.state.panels) {
      const btn = document.createElement('button');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(this.state.activePanel === panelId));
      btn.setAttribute('aria-label', PANEL_LABELS[panelId]);
      btn.title = PANEL_LABELS[panelId];
      btn.textContent = PANEL_ICONS[panelId];
      btn.className = 'ogrid-sidebar-tab';

      btn.style.width = `${TAB_WIDTH}px`;
      btn.style.height = `${TAB_WIDTH}px`;
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';
      btn.style.color = 'var(--ogrid-fg, #242424)';
      btn.style.fontSize = '14px';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';

      if (this.state.activePanel === panelId) {
        btn.style.background = 'var(--ogrid-bg, #fff)';
        btn.style.fontWeight = 'bold';
      } else {
        btn.style.background = 'transparent';
        btn.style.fontWeight = 'normal';
      }

      btn.addEventListener('click', () => {
        this.state.toggle(panelId);
      });

      strip.appendChild(btn);
    }

    return strip;
  }

  private createPanel(position: 'left' | 'right'): HTMLElement | null {
    if (!this.state.isOpen || !this.state.activePanel) return null;

    const panelContainer = document.createElement('div');
    panelContainer.setAttribute('role', 'tabpanel');
    panelContainer.setAttribute('aria-label', PANEL_LABELS[this.state.activePanel]);
    panelContainer.className = 'ogrid-sidebar-panel';
    panelContainer.style.width = `${PANEL_WIDTH}px`;
    panelContainer.style.display = 'flex';
    panelContainer.style.flexDirection = 'column';
    panelContainer.style.overflow = 'hidden';
    panelContainer.style.background = 'var(--ogrid-bg, #fff)';
    panelContainer.style.color = 'var(--ogrid-fg, #242424)';

    if (position === 'right') {
      panelContainer.style.borderLeft = '1px solid var(--ogrid-border, #e0e0e0)';
    } else {
      panelContainer.style.borderRight = '1px solid var(--ogrid-border, #e0e0e0)';
    }

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '8px 12px';
    header.style.borderBottom = '1px solid var(--ogrid-border, #e0e0e0)';
    header.style.fontWeight = '600';

    const title = document.createElement('span');
    title.textContent = PANEL_LABELS[this.state.activePanel];
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close panel');
    closeBtn.style.border = 'none';
    closeBtn.style.background = 'transparent';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.color = 'var(--ogrid-fg, #242424)';
    closeBtn.addEventListener('click', () => this.state.close());
    header.appendChild(closeBtn);

    panelContainer.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.style.flex = '1';
    body.style.overflowY = 'auto';
    body.style.padding = '8px 12px';

    if (this.state.activePanel === 'columns') {
      this.renderColumnsPanel(body);
    } else if (this.state.activePanel === 'filters') {
      this.renderFiltersPanel(body);
    }

    panelContainer.appendChild(body);
    return panelContainer;
  }

  private renderColumnsPanel(body: HTMLElement): void {
    if (!this.config) return;
    const { columns, visibleColumns, onVisibilityChange, onSetVisibleColumns } = this.config;

    const allVisible = columns.every(c => visibleColumns.has(c.columnId));

    // Button row
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.marginBottom = '8px';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.disabled = allVisible;
    selectAllBtn.className = 'ogrid-sidebar-action-btn';
    this.applyActionButtonStyle(selectAllBtn);
    selectAllBtn.addEventListener('click', () => {
      const next = new Set(visibleColumns);
      columns.forEach(c => next.add(c.columnId));
      onSetVisibleColumns(next);
    });
    btnRow.appendChild(selectAllBtn);

    const clearAllBtn = document.createElement('button');
    clearAllBtn.textContent = 'Clear All';
    clearAllBtn.className = 'ogrid-sidebar-action-btn';
    this.applyActionButtonStyle(clearAllBtn);
    clearAllBtn.addEventListener('click', () => {
      const next = new Set<string>();
      columns.forEach(c => {
        if (c.required && visibleColumns.has(c.columnId)) next.add(c.columnId);
      });
      onSetVisibleColumns(next);
    });
    btnRow.appendChild(clearAllBtn);

    body.appendChild(btnRow);

    // Column checkboxes
    for (const col of columns) {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '6px';
      label.style.padding = '2px 0';
      label.style.cursor = 'pointer';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = visibleColumns.has(col.columnId);
      checkbox.disabled = !!col.required;
      checkbox.addEventListener('change', () => {
        onVisibilityChange(col.columnId, checkbox.checked);
      });

      const text = document.createElement('span');
      text.textContent = col.name;

      label.appendChild(checkbox);
      label.appendChild(text);
      body.appendChild(label);
    }
  }

  private renderFiltersPanel(body: HTMLElement): void {
    if (!this.config) return;
    const { filterableColumns, filters, onFilterChange, filterOptions } = this.config;

    if (filterableColumns.length === 0) {
      const msg = document.createElement('div');
      msg.style.color = 'var(--ogrid-muted, #999)';
      msg.style.fontStyle = 'italic';
      msg.textContent = 'No filterable columns';
      body.appendChild(msg);
      return;
    }

    for (const col of filterableColumns) {
      const group = document.createElement('div');
      group.style.marginBottom = '12px';

      const labelEl = document.createElement('div');
      labelEl.style.fontWeight = '500';
      labelEl.style.marginBottom = '4px';
      labelEl.style.fontSize = '13px';
      labelEl.textContent = col.name;
      group.appendChild(labelEl);

      if (col.filterType === 'text') {
        const input = document.createElement('input');
        input.type = 'text';
        const fv = filters[col.filterField];
        input.value = fv?.type === 'text' ? fv.value : '';
        input.placeholder = `Filter ${col.name}...`;
        input.setAttribute('aria-label', `Filter ${col.name}`);
        this.applyTextInputStyle(input);
        input.addEventListener('input', () => {
          onFilterChange(col.filterField, input.value ? { type: 'text', value: input.value } : undefined);
        });
        group.appendChild(input);
      } else if (col.filterType === 'date') {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '4px';

        const fvDate = filters[col.filterField];
        const existingDate = fvDate?.type === 'date' ? fvDate.value : {} as import('@alaarab/ogrid-core').IDateFilterValue;

        // From date
        const fromLabel = document.createElement('label');
        fromLabel.style.display = 'flex';
        fromLabel.style.alignItems = 'center';
        fromLabel.style.gap = '4px';
        fromLabel.style.fontSize = '12px';
        fromLabel.textContent = 'From: ';

        const fromInput = document.createElement('input');
        fromInput.type = 'date';
        fromInput.value = existingDate.from ?? '';
        fromInput.setAttribute('aria-label', `${col.name} from date`);
        this.applyDateInputStyle(fromInput);

        fromLabel.appendChild(fromInput);
        container.appendChild(fromLabel);

        // To date
        const toLabel = document.createElement('label');
        toLabel.style.display = 'flex';
        toLabel.style.alignItems = 'center';
        toLabel.style.gap = '4px';
        toLabel.style.fontSize = '12px';
        toLabel.textContent = 'To: ';

        const toInput = document.createElement('input');
        toInput.type = 'date';
        toInput.value = existingDate.to ?? '';
        toInput.setAttribute('aria-label', `${col.name} to date`);
        this.applyDateInputStyle(toInput);

        toLabel.appendChild(toInput);
        container.appendChild(toLabel);

        const updateDate = () => {
          const from = fromInput.value || undefined;
          const to = toInput.value || undefined;
          onFilterChange(col.filterField, from || to ? { type: 'date', value: { from, to } } : undefined);
        };
        fromInput.addEventListener('change', updateDate);
        toInput.addEventListener('change', updateDate);

        group.appendChild(container);
      } else if (col.filterType === 'multiSelect') {
        const opts = filterOptions[col.filterField] ?? [];
        const container = document.createElement('div');
        container.style.maxHeight = '120px';
        container.style.overflowY = 'auto';
        container.setAttribute('role', 'group');
        container.setAttribute('aria-label', `${col.name} options`);

        const fvMulti = filters[col.filterField];
        const currentValues: string[] = fvMulti?.type === 'multiSelect' ? fvMulti.value : [];

        for (const opt of opts) {
          const optLabel = document.createElement('label');
          optLabel.style.display = 'flex';
          optLabel.style.alignItems = 'center';
          optLabel.style.gap = '4px';
          optLabel.style.padding = '1px 0';
          optLabel.style.cursor = 'pointer';
          optLabel.style.fontSize = '13px';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = currentValues.includes(opt);
          checkbox.addEventListener('change', () => {
            const currentFv = filters[col.filterField];
            const current: string[] = currentFv?.type === 'multiSelect' ? [...currentFv.value] : [];
            const next = checkbox.checked
              ? [...current, opt]
              : current.filter(v => v !== opt);
            onFilterChange(col.filterField, next.length > 0 ? { type: 'multiSelect', value: next } : undefined);
          });

          const text = document.createElement('span');
          text.textContent = opt;

          optLabel.appendChild(checkbox);
          optLabel.appendChild(text);
          container.appendChild(optLabel);
        }

        group.appendChild(container);
      }

      body.appendChild(group);
    }
  }

  private applyActionButtonStyle(btn: HTMLButtonElement): void {
    btn.style.flex = '1';
    btn.style.cursor = 'pointer';
    btn.style.background = 'var(--ogrid-bg-subtle, #f3f2f1)';
    btn.style.color = 'var(--ogrid-fg, #242424)';
    btn.style.border = '1px solid var(--ogrid-border, #e0e0e0)';
    btn.style.borderRadius = '4px';
    btn.style.padding = '4px 8px';
  }

  private applyTextInputStyle(input: HTMLInputElement): void {
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.style.padding = '4px 6px';
    input.style.background = 'var(--ogrid-bg, #fff)';
    input.style.color = 'var(--ogrid-fg, #242424)';
    input.style.border = '1px solid var(--ogrid-border, #e0e0e0)';
    input.style.borderRadius = '4px';
  }

  private applyDateInputStyle(input: HTMLInputElement): void {
    input.style.flex = '1';
    input.style.padding = '2px 4px';
    input.style.background = 'var(--ogrid-bg, #fff)';
    input.style.color = 'var(--ogrid-fg, #242424)';
    input.style.border = '1px solid var(--ogrid-border, #e0e0e0)';
    input.style.borderRadius = '4px';
  }

  destroy(): void {
    this.el?.remove();
    this.el = null;
  }
}
