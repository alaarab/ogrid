import { DEFAULT_COLOR_PALETTE, isValidHex, normalizeHex, isLightColor } from '@alaarab/ogrid-inputs';

/**
 * Context passed to the vanilla JS color picker cell editor.
 * Matches the interface from @alaarab/ogrid-js.
 */
export interface ColorPickerEditorContext {
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
 * Creates a color swatch grid cell editor for OGrid JS.
 *
 * Usage:
 *   import { createColorPickerEditor } from '@alaarab/ogrid-js-inputs';
 *
 *   const columns = [{
 *     columnId: 'color',
 *     cellEditor: createColorPickerEditor,
 *     cellEditorPopup: true,
 *     cellEditorParams: { allowCustom: true },
 *   }];
 */
export function createColorPickerEditor(context: ColorPickerEditorContext): HTMLElement {
  const { value, onValueChange, onCommit, onCancel, cellEditorParams } = context;

  const colors: string[] =
    Array.isArray(cellEditorParams?.['colors'])
      ? (cellEditorParams['colors'] as string[])
      : [...DEFAULT_COLOR_PALETTE];
  const allowCustom: boolean =
    typeof cellEditorParams?.['allowCustom'] === 'boolean' ? cellEditorParams['allowCustom'] : true;

  let selectedColor: string = '';
  if (value != null) {
    const normalized = normalizeHex(String(value));
    if (normalized) selectedColor = normalized;
  }

  // Create root element
  const root = document.createElement('div');
  Object.assign(root.style, {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    background: 'var(--ogrid-bg, #fff)',
    color: 'var(--ogrid-fg, #242424)',
    border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
    borderRadius: '8px',
    boxShadow: 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.15))',
    padding: '12px',
    width: '224px',
    userSelect: 'none',
  });
  root.addEventListener('mousedown', (e) => e.stopPropagation());

  // --- Header row ---
  const headerRow = document.createElement('div');
  Object.assign(headerRow.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  });

  const headerLabel = document.createElement('span');
  headerLabel.textContent = 'Color';
  Object.assign(headerLabel.style, { fontWeight: '600', fontSize: '13px' });

  // Preview swatch
  const previewSwatch = document.createElement('div');
  Object.assign(previewSwatch.style, {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    border: '1px solid var(--ogrid-border, rgba(0,0,0,0.15))',
    background: selectedColor || 'transparent',
    flexShrink: '0',
  });

  headerRow.appendChild(headerLabel);
  headerRow.appendChild(previewSwatch);
  root.appendChild(headerRow);

  // --- Swatch grid (5 columns × N rows) ---
  const swatchGrid = document.createElement('div');
  Object.assign(swatchGrid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '6px',
    marginBottom: '10px',
  });

  let activeSwatchEl: HTMLButtonElement | null = null;

  colors.forEach((color) => {
    const normalized = normalizeHex(color) ?? color;
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.setAttribute('aria-label', normalized);
    swatch.title = normalized;

    Object.assign(swatch.style, {
      width: '28px',
      height: '28px',
      borderRadius: '4px',
      cursor: 'pointer',
      background: normalized,
      border: normalized === selectedColor
        ? '2px solid var(--ogrid-fg, #242424)'
        : '1px solid rgba(0,0,0,0.15)',
      outline: 'none',
      transition: 'transform 0.1s ease, border-color 0.1s ease',
      padding: '0',
    });

    swatch.addEventListener('mouseenter', () => {
      swatch.style.transform = 'scale(1.18)';
    });

    swatch.addEventListener('mouseleave', () => {
      swatch.style.transform = 'scale(1)';
    });

    swatch.addEventListener('click', () => {
      selectedColor = normalized;
      previewSwatch.style.background = normalized;

      // Update borders
      if (activeSwatchEl) {
        activeSwatchEl.style.border = '1px solid rgba(0,0,0,0.15)';
      }
      swatch.style.border = '2px solid var(--ogrid-fg, #242424)';
      activeSwatchEl = swatch;

      if (customInput) customInput.value = normalized;
      onValueChange(normalized);
      setTimeout(() => onCommit(), 0);
    });

    if (normalized === selectedColor) {
      activeSwatchEl = swatch;
    }

    swatchGrid.appendChild(swatch);
  });

  root.appendChild(swatchGrid);

  // --- Custom hex input (optional) ---
  let customInput: HTMLInputElement | null = null;
  if (allowCustom) {
    const customRow = document.createElement('div');
    Object.assign(customRow.style, {
      display: 'flex',
      gap: '6px',
      marginBottom: '10px',
      alignItems: 'center',
    });

    const customLabel = document.createElement('span');
    customLabel.textContent = 'Hex';
    Object.assign(customLabel.style, {
      fontSize: '12px',
      color: 'var(--ogrid-muted, #888)',
      whiteSpace: 'nowrap',
    });

    customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.placeholder = '#RRGGBB';
    customInput.value = selectedColor;
    Object.assign(customInput.style, {
      flex: '1',
      padding: '4px 8px',
      border: '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
      borderRadius: '4px',
      fontSize: '12px',
      outline: 'none',
      background: 'var(--ogrid-bg, #fff)',
      color: 'inherit',
      fontFamily: 'monospace',
    });

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.textContent = 'Apply';
    Object.assign(applyBtn.style, {
      background: 'var(--ogrid-accent, #0078d4)',
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      whiteSpace: 'nowrap',
    });

    const applyCustomColor = () => {
      if (!customInput) return;
      const raw = customInput.value.trim();
      if (!raw) {
        selectedColor = '';
        previewSwatch.style.background = 'transparent';
        if (activeSwatchEl) {
          activeSwatchEl.style.border = '1px solid rgba(0,0,0,0.15)';
          activeSwatchEl = null;
        }
        onValueChange('');
        setTimeout(() => onCommit(), 0);
        return;
      }
      if (!isValidHex(raw)) {
        customInput.style.borderColor = 'var(--ogrid-error, #d32f2f)';
        return;
      }
      customInput.style.borderColor = 'var(--ogrid-border, rgba(0,0,0,0.2))';
      const normalized = normalizeHex(raw);
      if (!normalized) return;
      selectedColor = normalized;
      customInput.value = normalized;
      previewSwatch.style.background = normalized;
      // Update swatch borders
      if (activeSwatchEl) {
        activeSwatchEl.style.border = '1px solid rgba(0,0,0,0.15)';
        activeSwatchEl = null;
      }
      onValueChange(normalized);
      setTimeout(() => onCommit(), 0);
    };

    applyBtn.addEventListener('click', applyCustomColor);
    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        applyCustomColor();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    });

    customRow.appendChild(customLabel);
    customRow.appendChild(customInput);
    customRow.appendChild(applyBtn);
    root.appendChild(customRow);
  }

  // --- Footer ---
  const footer = document.createElement('div');
  Object.assign(footer.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '8px',
    borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
  });

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear';
  Object.assign(clearBtn.style, {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    color: 'var(--ogrid-accent, #0078d4)',
    fontWeight: '500',
  });
  clearBtn.addEventListener('click', () => {
    selectedColor = '';
    previewSwatch.style.background = 'transparent';
    if (activeSwatchEl) {
      activeSwatchEl.style.border = '1px solid rgba(0,0,0,0.15)';
      activeSwatchEl = null;
    }
    if (customInput) customInput.value = '';
    onValueChange('');
    onCommit();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  Object.assign(cancelBtn.style, {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    color: 'var(--ogrid-muted, #888)',
    fontWeight: '500',
  });
  cancelBtn.addEventListener('click', () => onCancel());

  footer.appendChild(clearBtn);
  footer.appendChild(cancelBtn);
  root.appendChild(footer);

  // Selected color label (show at bottom of swatch when selected)
  if (selectedColor) {
    const colorLabel = document.createElement('div');
    colorLabel.textContent = selectedColor.toUpperCase();
    Object.assign(colorLabel.style, {
      fontSize: '11px',
      color: 'var(--ogrid-muted, #888)',
      marginTop: '4px',
      fontFamily: 'monospace',
    });
    // Insert before footer
    root.insertBefore(colorLabel, footer);
  }

  // Global Escape handler
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  });

  // Suppress unused import warning  -  isLightColor is available for consumer use
  void isLightColor;

  return root;
}
