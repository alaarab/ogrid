import { mount } from '@vue/test-utils';
import { SliderEditor } from '../Slider/SliderEditor';
import type { ICellEditorProps } from '@alaarab/ogrid-core';

// ---------- Helpers ----------

type SliderEditorParams = NonNullable<ICellEditorProps<{ id: number }>['cellEditorParams']> & {
  min?: number;
  max?: number;
  step?: number;
};

type SliderEditorTestProps = Omit<ICellEditorProps<{ id: number }>, 'cellEditorParams'> & {
  cellEditorParams?: SliderEditorParams;
};

type SliderEditorComponentProps = InstanceType<typeof SliderEditor>['$props'];

function createMockProps(
  overrides: Partial<SliderEditorTestProps> = {},
): SliderEditorTestProps {
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

function mountEditor(overrides: Partial<SliderEditorTestProps> = {}) {
  const props = createMockProps(overrides);
  const wrapper = mount(SliderEditor, {
    props: props as unknown as SliderEditorComponentProps,
  });
  return { wrapper, props };
}

// ---------- Tests ----------

describe('SliderEditor', () => {
  // ── 1. Rendering ──

  describe('Rendering', () => {
    it('renders without errors', () => {
      expect(() => mountEditor()).not.toThrow();
    });

    it('renders a number input', () => {
      const { wrapper } = mountEditor({ value: 50 });
      const input = wrapper.find('input[type="number"]');
      expect(input.exists()).toBe(true);
    });

    it('shows initial value in the number input', () => {
      const { wrapper } = mountEditor({ value: 50 });
      const input = wrapper.find('input[type="number"]');
      expect((input.element as HTMLInputElement).value).toBe('50');
    });

    it('shows min and max labels (default 0 and 100)', () => {
      const { wrapper } = mountEditor({ value: 50 });
      expect(wrapper.text()).toContain('0');
      expect(wrapper.text()).toContain('100');
    });

    it('shows custom min and max labels', () => {
      const { wrapper } = mountEditor({
        value: 5,
        cellEditorParams: { min: 1, max: 10, step: 1 },
      });
      expect(wrapper.text()).toContain('1');
      expect(wrapper.text()).toContain('10');
    });

    it('shows an Apply button', () => {
      const { wrapper } = mountEditor();
      const applyBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Apply');
      expect(applyBtn!.exists()).toBe(true);
    });

    it('shows a Cancel button', () => {
      const { wrapper } = mountEditor();
      const cancelBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Cancel');
      expect(cancelBtn!.exists()).toBe(true);
    });
  });

  // ── 2. Initial Value ──

  describe('Initial Value', () => {
    it('null value defaults to min (0)', () => {
      const { wrapper } = mountEditor({ value: null });
      const input = wrapper.find('input[type="number"]');
      expect((input.element as HTMLInputElement).value).toBe('0');
    });

    it('undefined value defaults to min', () => {
      const { wrapper } = mountEditor({ value: undefined });
      const input = wrapper.find('input[type="number"]');
      expect((input.element as HTMLInputElement).value).toBe('0');
    });

    it('value above max is clamped to max', () => {
      const { wrapper } = mountEditor({
        value: 200,
        cellEditorParams: { min: 0, max: 100, step: 1 },
      });
      const input = wrapper.find('input[type="number"]');
      expect((input.element as HTMLInputElement).value).toBe('100');
    });

    it('value below min is clamped to min', () => {
      const { wrapper } = mountEditor({
        value: -50,
        cellEditorParams: { min: 0, max: 100, step: 1 },
      });
      const input = wrapper.find('input[type="number"]');
      expect((input.element as HTMLInputElement).value).toBe('0');
    });

    it('non-numeric value defaults to min', () => {
      const { wrapper } = mountEditor({ value: 'not-a-number' });
      const input = wrapper.find('input[type="number"]');
      expect((input.element as HTMLInputElement).value).toBe('0');
    });
  });

  // ── 3. Number Input Interaction ──

  describe('Number Input', () => {
    it('changing number input calls onValueChange', async () => {
      const { wrapper, props } = mountEditor({ value: 50 });
      const input = wrapper.find('input[type="number"]');

      await input.setValue('75');
      await input.trigger('input');

      expect(props.onValueChange).toHaveBeenCalled();
    });

    it('pressing Enter on number input calls onCommit', async () => {
      const { wrapper, props } = mountEditor({ value: 50 });
      const input = wrapper.find('input[type="number"]');

      await input.trigger('keydown', { key: 'Enter' });

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('pressing Escape on number input calls onCancel', async () => {
      const { wrapper, props } = mountEditor({ value: 50 });
      const input = wrapper.find('input[type="number"]');

      await input.trigger('keydown', { key: 'Escape' });

      expect(props.onCancel).toHaveBeenCalled();
    });
  });

  // ── 4. Keyboard on Root ──

  describe('Keyboard on Root', () => {
    it('Escape on root calls onCancel', async () => {
      const { wrapper, props } = mountEditor({ value: 50 });
      const root = wrapper.find('div[tabindex]');

      await root.trigger('keydown', { key: 'Escape' });

      expect(props.onCancel).toHaveBeenCalled();
    });

    it('Enter on root calls onCommit', async () => {
      const { wrapper, props } = mountEditor({ value: 50 });
      const root = wrapper.find('div[tabindex]');

      await root.trigger('keydown', { key: 'Enter' });

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('ArrowRight increases value by step', async () => {
      const { wrapper, props } = mountEditor({
        value: 50,
        cellEditorParams: { min: 0, max: 100, step: 5 },
      });
      const root = wrapper.find('div[tabindex]');

      await root.trigger('keydown', { key: 'ArrowRight' });

      expect(props.onValueChange).toHaveBeenCalledWith(55);
    });

    it('Home key sets value to min', async () => {
      const { wrapper, props } = mountEditor({
        value: 50,
        cellEditorParams: { min: 0, max: 100, step: 1 },
      });
      const root = wrapper.find('div[tabindex]');

      await root.trigger('keydown', { key: 'Home' });

      expect(props.onValueChange).toHaveBeenCalledWith(0);
    });

    it('End key sets value to max', async () => {
      const { wrapper, props } = mountEditor({
        value: 50,
        cellEditorParams: { min: 0, max: 100, step: 1 },
      });
      const root = wrapper.find('div[tabindex]');

      await root.trigger('keydown', { key: 'End' });

      expect(props.onValueChange).toHaveBeenCalledWith(100);
    });
  });

  // ── 5. Apply/Cancel Buttons ──

  describe('Apply and Cancel Buttons', () => {
    it('clicking Apply calls onCommit', async () => {
      const { wrapper, props } = mountEditor({ value: 50 });
      const applyBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Apply');

      await applyBtn!.trigger('click');

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('clicking Cancel calls onCancel', async () => {
      const { wrapper, props } = mountEditor({ value: 50 });
      const cancelBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Cancel');

      await cancelBtn!.trigger('click');

      expect(props.onCancel).toHaveBeenCalled();
    });
  });
});
