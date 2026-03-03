import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SliderEditor } from '../Slider/SliderEditor';
import type { ICellEditorProps } from '@alaarab/ogrid-core';

// ---------- Helpers ----------

function createMockProps(
  overrides: Partial<ICellEditorProps<{ id: number }>> = {},
): ICellEditorProps<{ id: number }> {
  return {
    value: 50,
    onValueChange: jest.fn(),
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    item: { id: 1 },
    column: { columnId: 'progress', name: 'Progress' },
    ...overrides,
  };
}

function renderEditor(overrides: Partial<ICellEditorProps<{ id: number }>> = {}) {
  const props = createMockProps(overrides);
  const result = render(<SliderEditor {...props} />);
  return { ...result, props };
}

function getValueInput(): HTMLInputElement {
  return screen.getByRole('textbox') as HTMLInputElement;
}

// ---------- Tests ----------

describe('SliderEditor', () => {
  // ── 1. Rendering ──

  describe('Rendering', () => {
    it('renders without errors', () => {
      expect(() => renderEditor()).not.toThrow();
    });

    it('renders a text input with the initial value', () => {
      renderEditor({ value: 50 });
      const input = getValueInput();
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('50');
    });

    it('shows min and max range labels (default 0 and 100)', () => {
      renderEditor({ value: 50 });
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('shows custom min and max labels', () => {
      renderEditor({
        value: 5,
        cellEditorParams: { min: 1, max: 10, step: 1 },
      });
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('shows current value as a label', () => {
      renderEditor({ value: 75 });
      // The value label is a <span> alongside the input
      expect(screen.getByText('75')).toBeInTheDocument();
    });
  });

  // ── 2. Initial Value ──

  describe('Initial Value', () => {
    it('null value defaults to min (0)', () => {
      renderEditor({ value: null });
      const input = getValueInput();
      expect(input.value).toBe('0');
    });

    it('undefined value defaults to min', () => {
      renderEditor({ value: undefined });
      const input = getValueInput();
      expect(input.value).toBe('0');
    });

    it('value above max is clamped to max', () => {
      renderEditor({ value: 200, cellEditorParams: { min: 0, max: 100, step: 1 } });
      const input = getValueInput();
      expect(input.value).toBe('100');
    });

    it('value below min is clamped to min', () => {
      renderEditor({ value: -50, cellEditorParams: { min: 0, max: 100, step: 1 } });
      const input = getValueInput();
      expect(input.value).toBe('0');
    });

    it('string numeric value is parsed', () => {
      renderEditor({ value: '42' });
      const input = getValueInput();
      expect(input.value).toBe('42');
    });
  });

  // ── 3. Text Input Interaction ──

  describe('Text Input', () => {
    it('typing a valid number in the input calls onValueChange', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: 50 });

      const input = getValueInput();
      await user.clear(input);
      await user.type(input, '75');

      expect(props.onValueChange).toHaveBeenCalled();
    });

    it('pressing Enter on the input calls onCommit', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: 50 });

      const input = getValueInput();
      await user.click(input);
      await user.keyboard('{Enter}');

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('pressing Escape on the input calls onCancel', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: 50 });

      const input = getValueInput();
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(props.onCancel).toHaveBeenCalled();
    });

    it('typing a number within range updates the value label', async () => {
      const user = userEvent.setup();
      renderEditor({ value: 50 });

      const input = getValueInput();
      await user.clear(input);
      await user.type(input, '80');

      expect(screen.getByText('80')).toBeInTheDocument();
    });
  });

  // ── 4. Range Info ──

  describe('Range Info', () => {
    it('shows Value label text', () => {
      renderEditor({ value: 50 });
      expect(screen.getByText('Value:')).toBeInTheDocument();
    });

    it('respects step snapping  -  value typed snaps to step', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({
        value: 0,
        cellEditorParams: { min: 0, max: 100, step: 10 },
      });

      const input = getValueInput();
      await user.clear(input);
      await user.type(input, '53');

      // 53 snaps to 50 (nearest multiple of 10)
      expect(props.onValueChange).toHaveBeenCalledWith(50);
    });
  });

  // ── 5. Edge Cases ──

  describe('Edge Cases', () => {
    it('renders with custom step', () => {
      renderEditor({ value: 5, cellEditorParams: { min: 0, max: 10, step: 2.5 } });
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('non-numeric value input falls back to min', () => {
      renderEditor({ value: 'not-a-number' });
      const input = getValueInput();
      expect(input.value).toBe('0');
    });
  });
});
