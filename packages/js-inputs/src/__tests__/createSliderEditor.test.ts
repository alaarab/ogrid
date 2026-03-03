import { createSliderEditor, SliderEditorContext } from '../Slider/createSliderEditor';

// ---------- Helpers ----------

function createMockContext(value: unknown = null): SliderEditorContext {
  return {
    value,
    onValueChange: jest.fn(),
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    item: {},
    column: { columnId: 'progress', name: 'Progress' } as any,
    cell: document.createElement('td'),
  };
}

function renderEditor(
  value: unknown = null,
  cellEditorParams?: Record<string, unknown>,
): { root: HTMLElement; context: SliderEditorContext } {
  const context = createMockContext(value);
  if (cellEditorParams) {
    context.cellEditorParams = cellEditorParams;
  }
  const root = createSliderEditor(context);
  document.body.appendChild(root);
  return { root, context };
}

function getNumberInput(root: HTMLElement): HTMLInputElement {
  return root.querySelector('input[type="number"]') as HTMLInputElement;
}

function clickButtonByText(root: HTMLElement, text: string): void {
  const allButtons = Array.from(root.querySelectorAll('button'));
  const btn = allButtons.find((b) => b.textContent === text);
  if (btn) btn.click();
}

// ---------- Tests ----------

describe('createSliderEditor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ── 1. Return type ──

  describe('Return type', () => {
    it('returns an HTMLElement', () => {
      const context = createMockContext(50);
      const result = createSliderEditor(context);
      expect(result).toBeInstanceOf(HTMLElement);
    });
  });

  // ── 2. Number input ──

  describe('Number input', () => {
    it('renders a number input element', () => {
      const { root } = renderEditor(50);
      expect(getNumberInput(root)).not.toBeNull();
    });

    it('shows the initial value in the number input', () => {
      const { root } = renderEditor(50);
      expect(getNumberInput(root).value).toBe('50');
    });

    it('null value defaults to min (0)', () => {
      const { root } = renderEditor(null);
      expect(getNumberInput(root).value).toBe('0');
    });

    it('value above max is clamped', () => {
      const { root } = renderEditor(200, { min: 0, max: 100, step: 1 });
      expect(getNumberInput(root).value).toBe('100');
    });

    it('value below min is clamped', () => {
      const { root } = renderEditor(-50, { min: 0, max: 100, step: 1 });
      expect(getNumberInput(root).value).toBe('0');
    });

    it('non-numeric value defaults to min', () => {
      const { root } = renderEditor('not-a-number');
      expect(getNumberInput(root).value).toBe('0');
    });
  });

  // ── 3. Range labels ──

  describe('Range labels', () => {
    it('shows min and max labels (default 0 and 100)', () => {
      const { root } = renderEditor(50);
      const spans = Array.from(root.querySelectorAll('span'));
      const spanTexts = spans.map((s) => s.textContent);
      expect(spanTexts).toContain('0');
      expect(spanTexts).toContain('100');
    });

    it('shows custom min and max labels', () => {
      const { root } = renderEditor(5, { min: 1, max: 10, step: 1 });
      const spans = Array.from(root.querySelectorAll('span'));
      const spanTexts = spans.map((s) => s.textContent);
      expect(spanTexts).toContain('1');
      expect(spanTexts).toContain('10');
    });

    it('shows "Value" header label', () => {
      const { root } = renderEditor(50);
      expect(root.textContent).toContain('Value');
    });
  });

  // ── 4. Value display ──

  describe('Value display', () => {
    it('shows current value in the header value display', () => {
      const { root } = renderEditor(75);
      // The value display span shows the current value
      expect(root.textContent).toContain('75');
    });
  });

  // ── 5. Number input keyboard ──

  describe('Number input keyboard', () => {
    it('pressing Enter in the number input calls onValueChange and onCommit', () => {
      const { root, context } = renderEditor(50);
      const input = getNumberInput(root);

      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );

      expect(context.onValueChange).toHaveBeenCalledWith(50);
      expect(context.onCommit).toHaveBeenCalled();
    });

    it('pressing Escape in the number input calls onCancel', () => {
      const { root, context } = renderEditor(50);
      const input = getNumberInput(root);

      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );

      expect(context.onCancel).toHaveBeenCalled();
    });

    it('typing a value in the number input calls onValueChange', () => {
      const { root, context } = renderEditor(50);
      const input = getNumberInput(root);

      // Simulate typing "75" by changing the value and firing input event
      input.value = '75';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(context.onValueChange).toHaveBeenCalledWith(75);
    });
  });

  // ── 6. Arrow key nudging on root ──

  describe('Arrow key nudging', () => {
    it('ArrowRight increases value by step', () => {
      const { root, context } = renderEditor(50, { min: 0, max: 100, step: 5 });

      root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      );

      expect(context.onValueChange).toHaveBeenCalledWith(55);
    });

    it('ArrowLeft decreases value by step', () => {
      const { root, context } = renderEditor(50, { min: 0, max: 100, step: 5 });

      root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
      );

      expect(context.onValueChange).toHaveBeenCalledWith(45);
    });

    it('ArrowRight at max stays at max', () => {
      const { root, context } = renderEditor(100, { min: 0, max: 100, step: 1 });

      root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      );

      expect(context.onValueChange).toHaveBeenCalledWith(100);
    });

    it('Escape on root calls onCancel', () => {
      const { root, context } = renderEditor(50);

      root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );

      expect(context.onCancel).toHaveBeenCalled();
    });
  });

  // ── 7. Footer buttons ──

  describe('Footer buttons', () => {
    it('has an Apply button', () => {
      const { root } = renderEditor(50);
      const allButtons = Array.from(root.querySelectorAll('button'));
      const applyBtn = allButtons.find((b) => b.textContent === 'Apply');
      expect(applyBtn).toBeDefined();
    });

    it('has a Cancel button', () => {
      const { root } = renderEditor(50);
      const allButtons = Array.from(root.querySelectorAll('button'));
      const cancelBtn = allButtons.find((b) => b.textContent === 'Cancel');
      expect(cancelBtn).toBeDefined();
    });

    it('clicking Apply calls onValueChange and onCommit', () => {
      const { root, context } = renderEditor(50);
      clickButtonByText(root, 'Apply');
      expect(context.onValueChange).toHaveBeenCalledWith(50);
      expect(context.onCommit).toHaveBeenCalled();
    });

    it('clicking Cancel calls onCancel', () => {
      const { root, context } = renderEditor(50);
      clickButtonByText(root, 'Cancel');
      expect(context.onCancel).toHaveBeenCalled();
    });
  });
});
