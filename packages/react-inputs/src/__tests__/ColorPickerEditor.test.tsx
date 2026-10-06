import '@testing-library/jest-dom';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPickerEditor } from '../ColorPicker/ColorPickerEditor';
import { DEFAULT_COLOR_PALETTE } from '@alaarab/ogrid-inputs';
import type { ICellEditorProps } from '@alaarab/ogrid-core';

// ---------- Helpers ----------

type ColorPickerEditorParams = NonNullable<ICellEditorProps<{ id: number }>['cellEditorParams']> & {
  allowCustom?: boolean;
  colors?: string[];
};

type ColorPickerEditorTestProps = Omit<ICellEditorProps<{ id: number }>, 'cellEditorParams'> & {
  cellEditorParams?: ColorPickerEditorParams;
};

function createMockProps(
  overrides: Partial<ColorPickerEditorTestProps> = {},
): ColorPickerEditorTestProps {
  return {
    value: '#FF6B6B',
    onValueChange: jest.fn(),
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    item: { id: 1 },
    column: { columnId: 'color', name: 'Color' },
    ...overrides,
  };
}

function renderEditor(overrides: Partial<ColorPickerEditorTestProps> = {}) {
  const props = createMockProps(overrides);
  const result = render(<ColorPickerEditor {...props} />);
  return { ...result, props };
}

// ---------- Tests ----------

describe('ColorPickerEditor', () => {
  // ── 1. Rendering ──

  describe('Rendering', () => {
    it('renders without errors', () => {
      expect(() => renderEditor()).not.toThrow();
    });

    it('renders swatch buttons for the default color palette', () => {
      renderEditor();
      // Each color in the palette gets an aria-label
      const swatchBtns = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('aria-label') !== null && btn.textContent !== 'Clear',
      );
      expect(swatchBtns.length).toBe(DEFAULT_COLOR_PALETTE.length);
    });

    it('renders a text input for custom hex when allowCustom is true (default)', () => {
      renderEditor();
      const input = screen.getByPlaceholderText('000000');
      expect(input).toBeInTheDocument();
    });

    it('does not render hex input when allowCustom is false', () => {
      renderEditor({ cellEditorParams: { allowCustom: false } });
      expect(screen.queryByPlaceholderText('000000')).not.toBeInTheDocument();
    });

    it('renders a Clear button', () => {
      renderEditor();
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });
  });

  // ── 2. Initial Value ──

  describe('Initial Value', () => {
    it('shows normalized initial hex in the text input', () => {
      renderEditor({ value: '#FF6B6B' });
      const input = screen.getByPlaceholderText('000000') as HTMLInputElement;
      expect(input.value).toBe('FF6B6B');
    });

    it('null value shows empty input', () => {
      renderEditor({ value: null });
      const input = screen.getByPlaceholderText('000000') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('undefined value shows empty input', () => {
      renderEditor({ value: undefined });
      const input = screen.getByPlaceholderText('000000') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('invalid hex value falls back  -  input shows raw value without #', () => {
      // When value is not a valid hex, normalizeHex returns null
      // and initialColor = String(value), so inputText = value without '#'
      renderEditor({ value: 'not-a-color' });
      const input = screen.getByPlaceholderText('000000') as HTMLInputElement;
      // not-a-color has no #, so inputText = 'not-a-color'
      expect(input.value).toBe('not-a-color');
    });

    it('3-digit hex value is expanded to 6 digits in the input', () => {
      renderEditor({ value: '#FFF' });
      const input = screen.getByPlaceholderText('000000') as HTMLInputElement;
      expect(input.value).toBe('FFFFFF');
    });
  });

  // ── 3. Swatch Click ──

  describe('Swatch Click', () => {
    it('clicking a swatch calls onValueChange with normalized hex', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: null });
      const firstColor = DEFAULT_COLOR_PALETTE[0] as string;
      const swatchBtn = screen.getByLabelText(firstColor);

      await user.click(swatchBtn);

      expect(props.onValueChange).toHaveBeenCalledWith(expect.stringMatching(/^#[0-9A-Fa-f]{6}$/));
    });

    it('clicking a swatch auto-commits via setTimeout', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: null });
      const firstColor = DEFAULT_COLOR_PALETTE[0] as string;
      const swatchBtn = screen.getByLabelText(firstColor);

      await user.click(swatchBtn);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(props.onCommit).toHaveBeenCalled();
    });
  });

  // ── 4. Hex Input ──

  describe('Hex Input', () => {
    it('typing a valid hex in input calls onValueChange', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: null });

      const input = screen.getByPlaceholderText('000000');
      await user.clear(input);
      await user.type(input, 'FF0000');

      expect(props.onValueChange).toHaveBeenCalledWith('#FF0000');
    });

    it('pressing Enter on hex input calls onCommit', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '#FF0000' });

      const input = screen.getByPlaceholderText('000000');
      await user.click(input);
      await user.keyboard('{Enter}');

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('pressing Escape on hex input calls onCancel', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '#FF0000' });

      const input = screen.getByPlaceholderText('000000');
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(props.onCancel).toHaveBeenCalled();
    });
  });

  // ── 5. Clear Button ──

  describe('Clear Button', () => {
    it('clicking Clear calls onValueChange with empty string', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '#FF6B6B' });
      await user.click(screen.getByText('Clear'));
      expect(props.onValueChange).toHaveBeenCalledWith('');
    });

    it('clicking Clear calls onCommit', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '#FF6B6B' });
      await user.click(screen.getByText('Clear'));
      expect(props.onCommit).toHaveBeenCalled();
    });

    it('clicking Clear clears the hex input', async () => {
      const user = userEvent.setup();
      renderEditor({ value: '#FF6B6B' });
      await user.click(screen.getByText('Clear'));
      const input = screen.getByPlaceholderText('000000') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  // ── 6. Custom Palette ──

  describe('Custom Palette', () => {
    it('renders swatches for custom color palette', () => {
      const customColors = ['#FF0000', '#00FF00', '#0000FF'];
      renderEditor({ cellEditorParams: { colors: customColors } });
      for (const color of customColors) {
        expect(screen.getByLabelText(color)).toBeInTheDocument();
      }
    });
  });

  // ── 7. Validation & alpha ──

  describe('I09 - no stale intermediate commit', () => {
    it('refuses to commit an incomplete 5-digit hex', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '#FF0000' });

      const input = screen.getByPlaceholderText('000000');
      await user.clear(input);
      await user.type(input, 'abcde');
      await user.keyboard('{Enter}');

      expect(props.onCommit).not.toHaveBeenCalled();
    });
  });

  describe('I21 - alpha is preserved', () => {
    it('shows an 8-digit alpha value and re-commits it unchanged', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '#FF000080' });

      const input = screen.getByPlaceholderText('000000') as HTMLInputElement;
      expect(input.value).toBe('FF000080');

      await user.click(input);
      await user.keyboard('{Enter}');

      expect(props.onValueChange).toHaveBeenLastCalledWith('#FF000080');
      expect(props.onCommit).toHaveBeenCalled();
    });
  });

  describe('I04 - swatches are keyboard reachable without a hex input', () => {
    it('makes swatches focusable when allowCustom is false', () => {
      renderEditor({ cellEditorParams: { allowCustom: false } });
      const swatches = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('aria-label') !== null && btn.textContent !== 'Clear',
      );
      expect(swatches.length).toBeGreaterThan(0);
      expect(swatches[0]).toHaveAttribute('tabindex', '0');
    });
  });

  describe('I04 - swatches use a roving tab stop', () => {
    const swatch = (hex: string) => screen.getByRole('button', { name: hex });

    it('focuses the selected swatch on open when there is no hex input', () => {
      const colors = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777'];
      renderEditor({ value: '#333333', cellEditorParams: { allowCustom: false, colors } });
      expect(swatch('#333333')).toHaveFocus();
      expect(swatch('#111111')).toHaveAttribute('tabindex', '-1');
    });

    it('arrows move between swatches and Enter picks one', () => {
      jest.useFakeTimers();
      try {
        const colors = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777'];
        const { props } = renderEditor({ value: '#111111', cellEditorParams: { allowCustom: false, colors } });
        fireEvent.keyDown(swatch('#111111'), { key: 'ArrowDown' });
        expect(swatch('#666666')).toHaveFocus();
        fireEvent.keyDown(swatch('#666666'), { key: 'ArrowRight' });
        expect(swatch('#777777')).toHaveFocus();
        fireEvent.keyDown(swatch('#777777'), { key: 'Enter' });
        expect(props.onValueChange).toHaveBeenLastCalledWith('#777777');
        act(() => { jest.runAllTimers(); });
        expect(props.onCommit).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it('keeps one swatch tabbable alongside the hex input', () => {
      renderEditor();
      const tabbable = screen.getAllByRole('button').filter(
        (b) => b.getAttribute('aria-pressed') !== null && b.getAttribute('tabindex') === '0',
      );
      expect(tabbable).toHaveLength(1);
    });
  });
});
