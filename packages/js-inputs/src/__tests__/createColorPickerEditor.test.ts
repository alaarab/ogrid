import { createColorPickerEditor, ColorPickerEditorContext } from '../ColorPicker/createColorPickerEditor';
import { DEFAULT_COLOR_PALETTE } from '@alaarab/ogrid-inputs';

// ---------- Helpers ----------

function createMockContext(value: unknown = null): ColorPickerEditorContext {
  return {
    value,
    onValueChange: jest.fn(),
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    item: {},
    column: { columnId: 'color', name: 'Color' } as any,
    cell: document.createElement('td'),
  };
}

function renderEditor(
  value: unknown = null,
  cellEditorParams?: Record<string, unknown>,
): { root: HTMLElement; context: ColorPickerEditorContext } {
  const context = createMockContext(value);
  if (cellEditorParams) {
    context.cellEditorParams = cellEditorParams;
  }
  const root = createColorPickerEditor(context);
  document.body.appendChild(root);
  return { root, context };
}

function getSwatchButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll('button[aria-label]')).filter(
    (btn) => btn.textContent !== 'Clear' && btn.textContent !== 'Cancel' && btn.textContent !== 'Apply',
  ) as HTMLButtonElement[];
}

function clickButtonByText(root: HTMLElement, text: string): void {
  const allButtons = Array.from(root.querySelectorAll('button'));
  const btn = allButtons.find((b) => b.textContent === text);
  if (btn) btn.click();
}

function getCustomInput(root: HTMLElement): HTMLInputElement | null {
  return root.querySelector('input[placeholder="#RRGGBB"]') as HTMLInputElement | null;
}

// ---------- Tests ----------

describe('createColorPickerEditor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ── 1. Return type ──

  describe('Return type', () => {
    it('returns an HTMLElement', () => {
      const context = createMockContext('#FF0000');
      const result = createColorPickerEditor(context);
      expect(result).toBeInstanceOf(HTMLElement);
    });
  });

  // ── 2. Swatch grid ──

  describe('Swatch grid', () => {
    it('renders a swatch button for each default color', () => {
      const { root } = renderEditor(null);
      const swatches = getSwatchButtons(root);
      expect(swatches).toHaveLength(DEFAULT_COLOR_PALETTE.length);
    });

    it('renders a swatch with the correct aria-label (normalized hex)', () => {
      const { root } = renderEditor(null);
      const firstNormalized = DEFAULT_COLOR_PALETTE[0] as string;
      const swatch = root.querySelector(`button[aria-label="${firstNormalized}"]`);
      expect(swatch).not.toBeNull();
    });

    it('renders swatches for custom color palette', () => {
      const customColors = ['#FF0000', '#00FF00', '#0000FF'];
      const { root } = renderEditor(null, { colors: customColors });
      for (const color of customColors) {
        expect(root.querySelector(`button[aria-label="${color}"]`)).not.toBeNull();
      }
    });
  });

  // ── 3. Initial value ──

  describe('Initial value', () => {
    it('null value shows the selected color header label and empty custom input', () => {
      const { root } = renderEditor(null);
      const input = getCustomInput(root);
      expect(input?.value).toBe('');
    });

    it('valid hex value shows it in the header label area', () => {
      const { root } = renderEditor('#FF0000');
      // The color label appears at the bottom showing the uppercase hex
      expect(root.textContent).toContain('#FF0000');
    });

    it('valid hex value pre-fills custom input', () => {
      const { root } = renderEditor('#FF0000');
      const input = getCustomInput(root);
      expect(input?.value).toBe('#FF0000');
    });

    it('invalid hex value shows empty custom input', () => {
      const { root } = renderEditor('not-a-color');
      const input = getCustomInput(root);
      expect(input?.value).toBe('');
    });
  });

  // ── 4. Swatch click ──

  describe('Swatch click', () => {
    it('clicking a swatch calls onValueChange with normalized hex', async () => {
      const { root, context } = renderEditor(null);
      const firstColor = DEFAULT_COLOR_PALETTE[0] as string;
      const swatch = root.querySelector(`button[aria-label="${firstColor}"]`) as HTMLButtonElement;

      swatch.click();

      expect(context.onValueChange).toHaveBeenCalledWith(firstColor);
    });

    it('clicking a swatch auto-commits via setTimeout', async () => {
      const { root, context } = renderEditor(null);
      const firstColor = DEFAULT_COLOR_PALETTE[0] as string;
      const swatch = root.querySelector(`button[aria-label="${firstColor}"]`) as HTMLButtonElement;

      swatch.click();

      await new Promise((r) => setTimeout(r, 10));

      expect(context.onCommit).toHaveBeenCalled();
    });

    it('clicking a swatch updates the custom input value', () => {
      const { root } = renderEditor(null);
      const firstColor = DEFAULT_COLOR_PALETTE[0] as string;
      const swatch = root.querySelector(`button[aria-label="${firstColor}"]`) as HTMLButtonElement;

      swatch.click();

      const input = getCustomInput(root);
      expect(input?.value).toBe(firstColor);
    });
  });

  // ── 5. Clear button ──

  describe('Clear button', () => {
    it('has a Clear button', () => {
      const { root } = renderEditor('#FF0000');
      const allButtons = Array.from(root.querySelectorAll('button'));
      const clearBtn = allButtons.find((b) => b.textContent === 'Clear');
      expect(clearBtn).toBeDefined();
    });

    it('clicking Clear calls onValueChange with empty string', () => {
      const { root, context } = renderEditor('#FF0000');
      clickButtonByText(root, 'Clear');
      expect(context.onValueChange).toHaveBeenCalledWith('');
    });

    it('clicking Clear calls onCommit', () => {
      const { root, context } = renderEditor('#FF0000');
      clickButtonByText(root, 'Clear');
      expect(context.onCommit).toHaveBeenCalled();
    });

    it('clicking Clear empties the custom hex input', () => {
      const { root } = renderEditor('#FF0000');
      clickButtonByText(root, 'Clear');
      const input = getCustomInput(root);
      expect(input?.value).toBe('');
    });
  });

  // ── 6. Custom hex input ──

  describe('Custom hex input', () => {
    it('renders a custom hex input when allowCustom is true (default)', () => {
      const { root } = renderEditor(null);
      expect(getCustomInput(root)).not.toBeNull();
    });

    it('does not render a custom hex input when allowCustom is false', () => {
      const { root } = renderEditor(null, { allowCustom: false });
      expect(getCustomInput(root)).toBeNull();
    });

    it('pressing Enter in the custom input applies the color', async () => {
      const { root, context } = renderEditor(null);
      const input = getCustomInput(root);
      expect(input).not.toBeNull();

      input!.value = '#00FF00';
      input!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );

      await new Promise((r) => setTimeout(r, 10));

      expect(context.onCommit).toHaveBeenCalled();
    });

    it('pressing Escape in the custom input calls onCancel', () => {
      const { root, context } = renderEditor(null);
      const input = getCustomInput(root);

      input!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );

      expect(context.onCancel).toHaveBeenCalled();
    });
  });

  // ── 7. Keyboard: Escape ──

  describe('Keyboard: Escape on root', () => {
    it('pressing Escape on root calls onCancel', () => {
      const { root, context } = renderEditor(null);

      root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );

      expect(context.onCancel).toHaveBeenCalled();
    });
  });

  // ── 8. Cancel button ──

  describe('Cancel button', () => {
    it('has a Cancel button', () => {
      const { root } = renderEditor(null);
      const allButtons = Array.from(root.querySelectorAll('button'));
      const cancelBtn = allButtons.find((b) => b.textContent === 'Cancel');
      expect(cancelBtn).toBeDefined();
    });

    it('clicking Cancel calls onCancel', () => {
      const { root, context } = renderEditor(null);
      clickButtonByText(root, 'Cancel');
      expect(context.onCancel).toHaveBeenCalled();
    });
  });
});
