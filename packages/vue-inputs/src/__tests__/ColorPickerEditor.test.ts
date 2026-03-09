import { mount } from '@vue/test-utils';
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

type ColorPickerEditorComponentProps = InstanceType<typeof ColorPickerEditor>['$props'];

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

function mountEditor(overrides: Partial<ColorPickerEditorTestProps> = {}) {
  const props = createMockProps(overrides);
  const wrapper = mount(ColorPickerEditor, {
    props: props as unknown as ColorPickerEditorComponentProps,
  });
  return { wrapper, props };
}

// ---------- Tests ----------

describe('ColorPickerEditor', () => {
  // ── 1. Rendering ──

  describe('Rendering', () => {
    it('renders without errors', () => {
      expect(() => mountEditor()).not.toThrow();
    });

    it('renders swatch buttons for the default color palette', () => {
      const { wrapper } = mountEditor();
      const swatchBtns = wrapper.findAll('button[aria-label]').filter(
        (btn) => btn.text() !== 'Clear',
      );
      expect(swatchBtns.length).toBe(DEFAULT_COLOR_PALETTE.length);
    });

    it('renders a hex text input when allowCustom is true (default)', () => {
      const { wrapper } = mountEditor();
      const input = wrapper.find('input[placeholder="#RRGGBB"]');
      expect(input.exists()).toBe(true);
    });

    it('does not render hex input when allowCustom is false', () => {
      const { wrapper } = mountEditor({ cellEditorParams: { allowCustom: false } });
      const input = wrapper.find('input[placeholder="#RRGGBB"]');
      expect(input.exists()).toBe(false);
    });

    it('renders a Clear button', () => {
      const { wrapper } = mountEditor();
      const clearBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Clear');
      expect(clearBtn!.exists()).toBe(true);
    });
  });

  // ── 2. Initial Value ──

  describe('Initial Value', () => {
    it('shows the initial hex value in the input', () => {
      const { wrapper } = mountEditor({ value: '#FF6B6B' });
      const input = wrapper.find('input[placeholder="#RRGGBB"]');
      expect((input.element as HTMLInputElement).value).toBe('#FF6B6B');
    });

    it('null value shows empty hex input', () => {
      const { wrapper } = mountEditor({ value: null });
      const input = wrapper.find('input[placeholder="#RRGGBB"]');
      expect((input.element as HTMLInputElement).value).toBe('');
    });

    it('undefined value shows empty hex input', () => {
      const { wrapper } = mountEditor({ value: undefined });
      const input = wrapper.find('input[placeholder="#RRGGBB"]');
      expect((input.element as HTMLInputElement).value).toBe('');
    });

    it('invalid hex value shows empty hex input', () => {
      const { wrapper } = mountEditor({ value: 'not-a-color' });
      const input = wrapper.find('input[placeholder="#RRGGBB"]');
      expect((input.element as HTMLInputElement).value).toBe('');
    });
  });

  // ── 3. Swatch Click ──

  describe('Swatch Click', () => {
    it('clicking a swatch calls onValueChange', async () => {
      const { wrapper, props } = mountEditor({ value: null });
      const firstColor = DEFAULT_COLOR_PALETTE[0] as string;
      const swatchBtn = wrapper.find(`button[aria-label="${firstColor}"]`);

      await swatchBtn.trigger('click');

      expect(props.onValueChange).toHaveBeenCalled();
    });

    it('clicking a swatch auto-commits via setTimeout', async () => {
      const { wrapper, props } = mountEditor({ value: null });
      const firstColor = DEFAULT_COLOR_PALETTE[0] as string;
      const swatchBtn = wrapper.find(`button[aria-label="${firstColor}"]`);

      await swatchBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 10));

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('clicking a selected swatch shows a checkmark', async () => {
      const firstColor = DEFAULT_COLOR_PALETTE[0] as string;
      const { wrapper } = mountEditor({ value: firstColor });

      const swatchBtn = wrapper.find(`button[aria-label="${firstColor}"]`);
      // The selected swatch renders ✓ inside
      expect(swatchBtn.text()).toContain('\u2713');
    });
  });

  // ── 4. Hex Input ──

  describe('Hex Input', () => {
    it('pressing Enter on hex input calls onCommit', async () => {
      const { wrapper, props } = mountEditor({ value: '#FF0000' });
      const input = wrapper.find('input[placeholder="#RRGGBB"]');

      await input.trigger('keydown', { key: 'Enter' });

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('pressing Escape on hex input calls onCancel', async () => {
      const { wrapper, props } = mountEditor({ value: '#FF0000' });
      const input = wrapper.find('input[placeholder="#RRGGBB"]');

      await input.trigger('keydown', { key: 'Escape' });

      expect(props.onCancel).toHaveBeenCalled();
    });

    it('typing a valid hex calls onValueChange', async () => {
      const { wrapper, props } = mountEditor({ value: null });
      const input = wrapper.find('input[placeholder="#RRGGBB"]');

      await input.setValue('#FF0000');
      await input.trigger('input');

      expect(props.onValueChange).toHaveBeenCalledWith('#FF0000');
    });
  });

  // ── 5. Clear Button ──

  describe('Clear Button', () => {
    it('clicking Clear calls onValueChange with empty string', async () => {
      const { wrapper, props } = mountEditor({ value: '#FF6B6B' });
      const clearBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Clear');

      await clearBtn!.trigger('click');

      expect(props.onValueChange).toHaveBeenCalledWith('');
    });

    it('clicking Clear calls onCommit', async () => {
      const { wrapper, props } = mountEditor({ value: '#FF6B6B' });
      const clearBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Clear');

      await clearBtn!.trigger('click');

      expect(props.onCommit).toHaveBeenCalled();
    });
  });

  // ── 6. Custom Palette ──

  describe('Custom Palette', () => {
    it('renders swatches for custom color palette', () => {
      const customColors = ['#FF0000', '#00FF00', '#0000FF'];
      const { wrapper } = mountEditor({ cellEditorParams: { colors: customColors } });

      for (const color of customColors) {
        expect(wrapper.find(`button[aria-label="${color}"]`).exists()).toBe(true);
      }
    });
  });
});
