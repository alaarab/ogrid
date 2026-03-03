import { mount } from '@vue/test-utils';
import { RatingEditor } from '../Rating/RatingEditor';
import type { ICellEditorProps } from '@alaarab/ogrid-core';

// ---------- Helpers ----------

function createMockProps(
  overrides: Partial<ICellEditorProps<{ id: number }>> = {},
): ICellEditorProps<{ id: number }> {
  return {
    value: 3,
    onValueChange: jest.fn(),
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    item: { id: 1 },
    column: { columnId: 'rating', name: 'Rating' },
    ...overrides,
  };
}

function mountEditor(overrides: Partial<ICellEditorProps<{ id: number }>> = {}) {
  const props = createMockProps(overrides);
  const wrapper = mount(RatingEditor, {
    props: props as Record<string, unknown>,
  });
  return { wrapper, props };
}

function getStarButtons(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('button').filter((btn) => btn.text() !== 'Clear');
}

// ---------- Tests ----------

describe('RatingEditor', () => {
  // ── 1. Rendering ──

  describe('Rendering', () => {
    it('renders without errors', () => {
      expect(() => mountEditor()).not.toThrow();
    });

    it('renders the default 5 star buttons', () => {
      const { wrapper } = mountEditor();
      const starButtons = getStarButtons(wrapper);
      expect(starButtons).toHaveLength(5);
    });

    it('renders custom maxStars count', () => {
      const { wrapper } = mountEditor({ cellEditorParams: { maxStars: 3 } });
      const starButtons = getStarButtons(wrapper);
      expect(starButtons).toHaveLength(3);
    });

    it('renders a Clear button', () => {
      const { wrapper } = mountEditor();
      const buttons = wrapper.findAll('button');
      const clearBtn = buttons.find((btn) => btn.text() === 'Clear');
      expect(clearBtn).toBeDefined();
      expect(clearBtn!.exists()).toBe(true);
    });

    it('shows "No rating" label when value is 0', () => {
      const { wrapper } = mountEditor({ value: 0 });
      expect(wrapper.text()).toContain('No rating');
    });

    it('shows numeric rating label for non-zero value', () => {
      const { wrapper } = mountEditor({ value: 3 });
      expect(wrapper.text()).toContain('3/5');
    });
  });

  // ── 2. Initial Value ──

  describe('Initial Value', () => {
    it('null value shows "No rating"', () => {
      const { wrapper } = mountEditor({ value: null });
      expect(wrapper.text()).toContain('No rating');
    });

    it('undefined value shows "No rating"', () => {
      const { wrapper } = mountEditor({ value: undefined });
      expect(wrapper.text()).toContain('No rating');
    });

    it('string "0" value shows "No rating"', () => {
      const { wrapper } = mountEditor({ value: '0' });
      expect(wrapper.text()).toContain('No rating');
    });

    it('numeric value is reflected in label', () => {
      const { wrapper } = mountEditor({ value: 4 });
      expect(wrapper.text()).toContain('4/5');
    });

    it('value exceeding maxStars is clamped', () => {
      const { wrapper } = mountEditor({ value: 10, cellEditorParams: { maxStars: 5 } });
      expect(wrapper.text()).toContain('5/5');
    });
  });

  // ── 3. Star Click ──

  describe('Star Click', () => {
    it('clicking a star calls onValueChange', async () => {
      const { wrapper, props } = mountEditor({ value: 0 });
      const starButtons = getStarButtons(wrapper);

      await starButtons[0]!.trigger('click');

      expect(props.onValueChange).toHaveBeenCalled();
    });

    it('clicking a star auto-commits via setTimeout', async () => {
      const { wrapper, props } = mountEditor({ value: 0 });
      const starButtons = getStarButtons(wrapper);

      await starButtons[2]!.trigger('click');
      await new Promise((r) => setTimeout(r, 10));

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('each star has an accessible aria-label', () => {
      const { wrapper } = mountEditor();
      const starButtons = getStarButtons(wrapper);
      // Stars should have aria-labels like "1 star", "2 stars", ...
      for (const btn of starButtons) {
        expect(btn.attributes('aria-label')).toBeTruthy();
      }
    });
  });

  // ── 4. Clear Button ──

  describe('Clear Button', () => {
    it('clicking Clear calls onValueChange', async () => {
      const { wrapper, props } = mountEditor({ value: 3 });
      const clearBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Clear');

      await clearBtn!.trigger('click');

      expect(props.onValueChange).toHaveBeenCalled();
    });

    it('clicking Clear calls onCommit', async () => {
      const { wrapper, props } = mountEditor({ value: 3 });
      const clearBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Clear');

      await clearBtn!.trigger('click');

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('clicking Clear resets label to "No rating"', async () => {
      const { wrapper } = mountEditor({ value: 3 });
      const clearBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Clear');

      await clearBtn!.trigger('click');

      expect(wrapper.text()).toContain('No rating');
    });
  });

  // ── 5. Keyboard ──

  describe('Keyboard', () => {
    it('Escape keydown calls onCancel', async () => {
      const { wrapper, props } = mountEditor({ value: 3 });
      const root = wrapper.find('div[tabindex]');

      await root.trigger('keydown', { key: 'Escape' });

      expect(props.onCancel).toHaveBeenCalled();
    });

    it('ArrowRight keydown increases rating by 1', async () => {
      const { wrapper, props } = mountEditor({ value: 2 });
      const root = wrapper.find('div[tabindex]');

      await root.trigger('keydown', { key: 'ArrowRight' });

      // onValueChange should be called with 3 (2 + 1)
      await new Promise((r) => setTimeout(r, 10));
      expect(props.onValueChange).toHaveBeenCalledWith(3);
    });

    it('ArrowLeft keydown decreases rating by 1', async () => {
      const { wrapper, props } = mountEditor({ value: 3 });
      const root = wrapper.find('div[tabindex]');

      await root.trigger('keydown', { key: 'ArrowLeft' });

      await new Promise((r) => setTimeout(r, 10));
      expect(props.onValueChange).toHaveBeenCalledWith(2);
    });
  });
});
