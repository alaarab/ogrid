import { getCalendarGrid, formatDate, parseDate, DAY_NAMES, MONTH_NAMES } from '@alaarab/ogrid-inputs';

/**
 * Context passed to vanilla JS custom cell editors.
 * Matches the interface from @alaarab/ogrid-js.
 */
export interface DatePickerEditorContext {
  value: unknown;
  onValueChange: (value: unknown) => void;
  onCommit: () => void;
  onCancel: () => void;
  item: unknown;
  column: unknown;
  cell: HTMLTableCellElement;
  cellEditorParams?: Record<string, unknown>;
}

/**
 * Creates a calendar-based date picker editor for OGrid JS.
 *
 * Usage:
 *   import { createDatePickerEditor } from '@alaarab/ogrid-js-inputs';
 *
 *   const columns = [{
 *     columnId: 'dueDate',
 *     cellEditor: createDatePickerEditor,
 *     cellEditorPopup: true,
 *   }];
 */
export function createDatePickerEditor(context: DatePickerEditorContext): HTMLElement {
  const { value, onValueChange, onCommit, onCancel } = context;

  // State
  let viewYear: number;
  let viewMonth: number;
  let selectedDate = '';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let hoveredCell: string | null = null;

  // Parse initial value
  const initial = value != null ? parseDate(String(value)) : null;
  if (initial) {
    viewYear = initial.year;
    viewMonth = initial.month;
    selectedDate = formatDate(initial.year, initial.month, initial.date);
  } else {
    const today = new Date();
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
  }

  // Create root element
  const root = document.createElement('div');
  // Apply rootStyle (same as React version)
  Object.assign(root.style, {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    background: 'var(--ogrid-bg, #fff)',
    color: 'var(--ogrid-fg, #242424)',
    border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
    borderRadius: '8px',
    boxShadow: 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.15))',
    padding: '12px',
    width: '280px',
    userSelect: 'none',
  });
  root.addEventListener('mousedown', (e) => e.stopPropagation());

  // --- Input row ---
  const inputRow = document.createElement('div');
  Object.assign(inputRow.style, { display: 'flex', gap: '6px', marginBottom: '8px' });

  const input = document.createElement('input');
  input.type = 'text';
  input.value = selectedDate;
  input.placeholder = 'YYYY-MM-DD';
  Object.assign(input.style, {
    flex: '1',
    padding: '4px 8px',
    border: '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    background: 'var(--ogrid-bg, #fff)',
    color: 'inherit',
  });

  input.addEventListener('input', () => {
    const text = input.value;
    const parsed = parseDate(text);
    if (parsed) {
      selectedDate = formatDate(parsed.year, parsed.month, parsed.date);
      viewYear = parsed.year;
      viewMonth = parsed.month;
      onValueChange(text);
      renderGrid();
      renderHeader();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onValueChange(input.value);
      onCommit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  });

  inputRow.appendChild(input);
  root.appendChild(inputRow);

  // --- Header ---
  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  });

  const createHeaderBtn = (text: string, label: string, handler: () => void) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = text;
    btn.setAttribute('aria-label', label);
    Object.assign(btn.style, {
      background: 'none', border: 'none', cursor: 'pointer',
      padding: '4px 8px', borderRadius: '4px', fontSize: '14px',
      color: 'inherit', lineHeight: '1',
    });
    btn.addEventListener('click', handler);
    return btn;
  };

  const prevBtn = createHeaderBtn('&#8249;', 'Previous month', () => {
    if (viewMonth === 0) { viewMonth = 11; viewYear--; }
    else viewMonth--;
    renderHeader();
    renderGrid();
  });

  const headerTitle = document.createElement('span');
  Object.assign(headerTitle.style, { fontWeight: '600', fontSize: '14px' });

  const nextBtn = createHeaderBtn('&#8250;', 'Next month', () => {
    if (viewMonth === 11) { viewMonth = 0; viewYear++; }
    else viewMonth++;
    renderHeader();
    renderGrid();
  });

  header.appendChild(prevBtn);
  header.appendChild(headerTitle);
  header.appendChild(nextBtn);
  root.appendChild(header);

  // --- Grid ---
  const gridEl = document.createElement('div');
  Object.assign(gridEl.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '1px',
    textAlign: 'center',
  });

  // Day headers (static)
  DAY_NAMES.forEach((d) => {
    const dh = document.createElement('div');
    dh.textContent = d;
    Object.assign(dh.style, {
      padding: '4px 0', fontSize: '11px', fontWeight: '600',
      color: 'var(--ogrid-muted, #888)',
    });
    gridEl.appendChild(dh);
  });

  root.appendChild(gridEl);

  // --- Footer ---
  const footer = document.createElement('div');
  Object.assign(footer.style, {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: '8px', paddingTop: '8px',
    borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
  });

  const createFooterBtn = (text: string, handler: () => void) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    Object.assign(btn.style, {
      background: 'none', border: 'none', cursor: 'pointer',
      padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
      color: 'var(--ogrid-accent, #0078d4)', fontWeight: '500',
    });
    btn.addEventListener('click', handler);
    return btn;
  };

  const todayBtn = createFooterBtn('Today', () => {
    const t = new Date();
    const formatted = formatDate(t.getFullYear(), t.getMonth(), t.getDate());
    selectedDate = formatted;
    input.value = formatted;
    viewYear = t.getFullYear();
    viewMonth = t.getMonth();
    onValueChange(formatted);
    renderHeader();
    renderGrid();
    setTimeout(() => onCommit(), 0);
  });

  const clearBtn = createFooterBtn('Clear', () => {
    selectedDate = '';
    input.value = '';
    onValueChange('');
    onCommit();
  });

  footer.appendChild(todayBtn);
  footer.appendChild(clearBtn);
  root.appendChild(footer);

  // --- Render functions ---
  function renderHeader() {
    headerTitle.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
  }

  function renderGrid() {
    // Remove old date cells (keep the 7 day headers)
    while (gridEl.children.length > 7) {
      if (gridEl.lastChild) gridEl.removeChild(gridEl.lastChild);
    }

    const grid = getCalendarGrid(viewYear, viewMonth);
    grid.flat().forEach((day) => {
      const key = formatDate(day.year, day.month, day.date);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(day.date);
      btn.tabIndex = -1;

      // Base cell style
      Object.assign(btn.style, {
        padding: '6px 0', borderRadius: '4px', cursor: 'pointer',
        fontSize: '13px', lineHeight: '1', border: 'none',
        background: 'none', color: 'inherit',
      });

      // Conditional styles
      if (!day.isCurrentMonth) {
        btn.style.color = 'var(--ogrid-muted, #ccc)';
      }
      if (day.isToday && key !== selectedDate) {
        btn.style.fontWeight = '700';
        btn.style.color = 'var(--ogrid-accent, #0078d4)';
      }
      if (key === selectedDate) {
        btn.style.background = 'var(--ogrid-accent, #0078d4)';
        btn.style.color = '#fff';
        btn.style.fontWeight = '600';
      }

      btn.addEventListener('mouseenter', () => {
        hoveredCell = key;
        if (key !== selectedDate) {
          btn.style.background = 'var(--ogrid-bg-hover, #f0f0f0)';
        }
      });
      btn.addEventListener('mouseleave', () => {
        hoveredCell = null;
        if (key !== selectedDate) {
          btn.style.background = 'none';
          // Restore today style if needed
          if (day.isToday) {
            btn.style.fontWeight = '700';
            btn.style.color = 'var(--ogrid-accent, #0078d4)';
          }
        }
      });

      btn.addEventListener('click', () => {
        selectedDate = key;
        input.value = key;
        onValueChange(key);
        renderGrid(); // Re-render to update selection visual
        setTimeout(() => onCommit(), 0);
      });

      gridEl.appendChild(btn);
    });
  }

  // Global Escape handler
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  });

  // Initial render
  renderHeader();
  renderGrid();

  // Focus input
  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);

  return root;
}
