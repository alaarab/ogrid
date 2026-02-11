import type { HeaderFilterState, HeaderFilterConfig } from '../state/HeaderFilterState';

/**
 * Renders header filter popover (dropdown) in DOM.
 * Instantiated by OGrid, reads state from HeaderFilterState.
 */
export class HeaderFilter {
  private state: HeaderFilterState;
  private popoverEl: HTMLElement | null = null;

  constructor(state: HeaderFilterState) {
    this.state = state;
  }

  /**
   * Render the popover for the currently open filter.
   * Call this whenever HeaderFilterState changes.
   */
  render(config: HeaderFilterConfig | null): void {
    this.cleanup();

    if (!config || !this.state.openColumnId || !this.state.popoverPosition) return;

    const pos = this.state.popoverPosition;

    this.popoverEl = document.createElement('div');
    this.popoverEl.className = 'ogrid-header-filter-popover';
    this.popoverEl.style.position = 'fixed';
    this.popoverEl.style.top = `${pos.top}px`;
    this.popoverEl.style.left = `${pos.left}px`;
    this.popoverEl.style.zIndex = '9999';
    this.popoverEl.style.background = 'var(--ogrid-bg, #fff)';
    this.popoverEl.style.color = 'var(--ogrid-fg, #242424)';
    this.popoverEl.style.border = '1px solid var(--ogrid-border, #e0e0e0)';
    this.popoverEl.style.borderRadius = '4px';
    this.popoverEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    this.popoverEl.style.padding = '8px';
    this.popoverEl.style.minWidth = '200px';
    this.popoverEl.style.maxHeight = '320px';
    this.popoverEl.style.overflowY = 'auto';

    // Stop clicks within popover from propagating
    this.popoverEl.addEventListener('click', (e) => e.stopPropagation());
    this.popoverEl.addEventListener('mousedown', (e) => e.stopPropagation());

    if (config.filterType === 'text') {
      this.renderTextFilter(config);
    } else if (config.filterType === 'multiSelect') {
      this.renderMultiSelectFilter(config);
    } else if (config.filterType === 'date') {
      this.renderDateFilter(config);
    }

    document.body.appendChild(this.popoverEl);
  }

  private renderTextFilter(config: HeaderFilterConfig): void {
    if (!this.popoverEl) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = this.state.tempTextValue;
    input.placeholder = 'Filter...';
    input.setAttribute('aria-label', 'Text filter');
    input.className = 'ogrid-filter-text-input';
    this.applyInputStyle(input);
    input.style.marginBottom = '8px';

    input.addEventListener('input', () => {
      this.state.setTempTextValue(input.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.state.applyTextFilter(config.filterField);
      }
      e.stopPropagation();
    });

    this.popoverEl.appendChild(input);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.className = 'ogrid-filter-apply-btn';
    this.applyButtonStyle(applyBtn);
    applyBtn.addEventListener('click', () => this.state.applyTextFilter(config.filterField));
    btnRow.appendChild(applyBtn);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.className = 'ogrid-filter-clear-btn';
    this.applyButtonStyle(clearBtn);
    clearBtn.addEventListener('click', () => this.state.clearTextFilter(config.filterField));
    btnRow.appendChild(clearBtn);

    this.popoverEl.appendChild(btnRow);

    // Focus input
    setTimeout(() => input.focus(), 0);
  }

  private renderMultiSelectFilter(config: HeaderFilterConfig): void {
    if (!this.popoverEl) return;

    // Search box
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.value = this.state.searchText;
    searchInput.placeholder = 'Search...';
    searchInput.setAttribute('aria-label', 'Search filter options');
    searchInput.className = 'ogrid-filter-search-input';
    this.applyInputStyle(searchInput);
    searchInput.style.marginBottom = '8px';

    searchInput.addEventListener('input', () => {
      this.state.setSearchText(searchInput.value);
      this.updateCheckboxList(config, checkboxContainer);
    });
    searchInput.addEventListener('keydown', (e) => e.stopPropagation());

    this.popoverEl.appendChild(searchInput);

    // Select all / Clear all buttons
    const actionRow = document.createElement('div');
    actionRow.style.display = 'flex';
    actionRow.style.gap = '8px';
    actionRow.style.marginBottom = '8px';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.className = 'ogrid-filter-select-all-btn';
    this.applySmallButtonStyle(selectAllBtn);
    selectAllBtn.addEventListener('click', () => {
      this.state.handleSelectAll(config.filterField);
      this.updateCheckboxList(config, checkboxContainer);
    });
    actionRow.appendChild(selectAllBtn);

    const clearSelBtn = document.createElement('button');
    clearSelBtn.textContent = 'Clear';
    clearSelBtn.className = 'ogrid-filter-clear-sel-btn';
    this.applySmallButtonStyle(clearSelBtn);
    clearSelBtn.addEventListener('click', () => {
      this.state.handleClearSelection();
      this.updateCheckboxList(config, checkboxContainer);
    });
    actionRow.appendChild(clearSelBtn);

    this.popoverEl.appendChild(actionRow);

    // Checkbox list container
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'ogrid-filter-checkbox-list';
    checkboxContainer.style.maxHeight = '160px';
    checkboxContainer.style.overflowY = 'auto';
    checkboxContainer.style.marginBottom = '8px';
    checkboxContainer.setAttribute('role', 'group');
    checkboxContainer.setAttribute('aria-label', 'Filter options');

    this.updateCheckboxList(config, checkboxContainer);
    this.popoverEl.appendChild(checkboxContainer);

    // Apply button
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.className = 'ogrid-filter-apply-btn';
    this.applyButtonStyle(applyBtn);
    applyBtn.addEventListener('click', () => this.state.applyMultiSelectFilter(config.filterField));
    this.popoverEl.appendChild(applyBtn);
  }

  private updateCheckboxList(config: HeaderFilterConfig, container: HTMLElement): void {
    container.innerHTML = '';
    const options = this.state.getFilteredOptions(config.filterField);
    const selected = this.state.tempSelected;

    for (const opt of options) {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '4px';
      label.style.padding = '2px 0';
      label.style.cursor = 'pointer';
      label.style.fontSize = '13px';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(opt);
      checkbox.addEventListener('change', () => {
        this.state.handleCheckboxChange(opt, checkbox.checked);
      });

      const text = document.createElement('span');
      text.textContent = opt;

      label.appendChild(checkbox);
      label.appendChild(text);
      container.appendChild(label);
    }

    if (options.length === 0) {
      const empty = document.createElement('div');
      empty.style.color = 'var(--ogrid-muted, #999)';
      empty.style.fontStyle = 'italic';
      empty.style.padding = '4px 0';
      empty.textContent = 'No options';
      container.appendChild(empty);
    }
  }

  private renderDateFilter(config: HeaderFilterConfig): void {
    if (!this.popoverEl) return;

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';

    // From date
    const fromLabel = document.createElement('label');
    fromLabel.style.display = 'flex';
    fromLabel.style.alignItems = 'center';
    fromLabel.style.gap = '4px';
    fromLabel.style.fontSize = '13px';
    fromLabel.textContent = 'From: ';

    const fromInput = document.createElement('input');
    fromInput.type = 'date';
    fromInput.value = this.state.tempDateFrom;
    fromInput.setAttribute('aria-label', 'From date');
    this.applyInputStyle(fromInput);
    fromInput.addEventListener('change', () => {
      this.state.setTempDateFrom(fromInput.value);
    });
    fromInput.addEventListener('keydown', (e) => e.stopPropagation());
    fromLabel.appendChild(fromInput);
    container.appendChild(fromLabel);

    // To date
    const toLabel = document.createElement('label');
    toLabel.style.display = 'flex';
    toLabel.style.alignItems = 'center';
    toLabel.style.gap = '4px';
    toLabel.style.fontSize = '13px';
    toLabel.textContent = 'To: ';

    const toInput = document.createElement('input');
    toInput.type = 'date';
    toInput.value = this.state.tempDateTo;
    toInput.setAttribute('aria-label', 'To date');
    this.applyInputStyle(toInput);
    toInput.addEventListener('change', () => {
      this.state.setTempDateTo(toInput.value);
    });
    toInput.addEventListener('keydown', (e) => e.stopPropagation());
    toLabel.appendChild(toInput);
    container.appendChild(toLabel);

    this.popoverEl.appendChild(container);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.marginTop = '8px';

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.className = 'ogrid-filter-apply-btn';
    this.applyButtonStyle(applyBtn);
    applyBtn.addEventListener('click', () => this.state.applyDateFilter(config.filterField));
    btnRow.appendChild(applyBtn);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.className = 'ogrid-filter-clear-btn';
    this.applyButtonStyle(clearBtn);
    clearBtn.addEventListener('click', () => this.state.clearDateFilter(config.filterField));
    btnRow.appendChild(clearBtn);

    this.popoverEl.appendChild(btnRow);
  }

  private applyInputStyle(input: HTMLInputElement): void {
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.style.padding = '4px 6px';
    input.style.background = 'var(--ogrid-bg, #fff)';
    input.style.color = 'var(--ogrid-fg, #242424)';
    input.style.border = '1px solid var(--ogrid-border, #e0e0e0)';
    input.style.borderRadius = '4px';
  }

  private applyButtonStyle(btn: HTMLButtonElement): void {
    btn.style.flex = '1';
    btn.style.cursor = 'pointer';
    btn.style.padding = '6px 12px';
    btn.style.background = 'var(--ogrid-bg-subtle, #f3f2f1)';
    btn.style.color = 'var(--ogrid-fg, #242424)';
    btn.style.border = '1px solid var(--ogrid-border, #e0e0e0)';
    btn.style.borderRadius = '4px';
  }

  private applySmallButtonStyle(btn: HTMLButtonElement): void {
    btn.style.cursor = 'pointer';
    btn.style.padding = '2px 8px';
    btn.style.fontSize = '12px';
    btn.style.background = 'transparent';
    btn.style.color = 'var(--ogrid-fg, #242424)';
    btn.style.border = '1px solid var(--ogrid-border, #e0e0e0)';
    btn.style.borderRadius = '4px';
  }

  cleanup(): void {
    if (this.popoverEl) {
      this.popoverEl.remove();
      this.popoverEl = null;
    }
  }

  destroy(): void {
    this.cleanup();
  }
}
