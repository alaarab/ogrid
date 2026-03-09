import { mount } from '@vue/test-utils';
import { TagsEditor } from '../Tags/TagsEditor';
import type { ICellEditorProps } from '@alaarab/ogrid-core';

// ---------- Helpers ----------

type TagsEditorParams = NonNullable<ICellEditorProps<{ id: number }>['cellEditorParams']> & {
  suggestions?: string[];
  allowCreate?: boolean;
  showApplyButton?: boolean;
};

type TagsEditorTestProps = Omit<ICellEditorProps<{ id: number }>, 'cellEditorParams'> & {
  cellEditorParams?: TagsEditorParams;
};

type TagsEditorComponentProps = InstanceType<typeof TagsEditor>['$props'];

function createMockProps(
  overrides: Partial<TagsEditorTestProps> = {},
): TagsEditorTestProps {
  return {
    value: 'Bug, Feature',
    onValueChange: jest.fn(),
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    item: { id: 1 },
    column: { columnId: 'labels', name: 'Labels' },
    ...overrides,
  };
}

function mountEditor(overrides: Partial<TagsEditorTestProps> = {}) {
  const props = createMockProps(overrides);
  const wrapper = mount(TagsEditor, {
    props: props as unknown as TagsEditorComponentProps,
  });
  return { wrapper, props };
}

function getTagInput(wrapper: ReturnType<typeof mount>): ReturnType<typeof wrapper.find> {
  return wrapper.find('input[type="text"]');
}

// ---------- Tests ----------

describe('TagsEditor', () => {
  // ── 1. Rendering ──

  describe('Rendering', () => {
    it('renders without errors', () => {
      expect(() => mountEditor()).not.toThrow();
    });

    it('renders tags from initial comma-separated string value', () => {
      const { wrapper } = mountEditor({ value: 'Bug, Feature' });
      expect(wrapper.text()).toContain('Bug');
      expect(wrapper.text()).toContain('Feature');
    });

    it('renders a text input for tag entry', () => {
      const { wrapper } = mountEditor();
      expect(getTagInput(wrapper).exists()).toBe(true);
    });

    it('shows tag count in footer', () => {
      const { wrapper } = mountEditor({ value: 'Bug, Feature' });
      expect(wrapper.text()).toContain('2 tags');
    });

    it('shows singular "1 tag" when only one tag', () => {
      const { wrapper } = mountEditor({ value: 'Bug' });
      expect(wrapper.text()).toContain('1 tag');
    });

    it('shows "No tags" when no tags exist', () => {
      const { wrapper } = mountEditor({ value: null });
      expect(wrapper.text()).toContain('No tags');
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
    it('null value renders "No tags"', () => {
      const { wrapper } = mountEditor({ value: null });
      expect(wrapper.text()).toContain('No tags');
    });

    it('undefined value renders "No tags"', () => {
      const { wrapper } = mountEditor({ value: undefined });
      expect(wrapper.text()).toContain('No tags');
    });

    it('empty string value renders "No tags"', () => {
      const { wrapper } = mountEditor({ value: '' });
      expect(wrapper.text()).toContain('No tags');
    });

    it('array value is parsed into individual tags', () => {
      const { wrapper } = mountEditor({ value: ['Alpha', 'Beta', 'Gamma'] as unknown as string });
      expect(wrapper.text()).toContain('Alpha');
      expect(wrapper.text()).toContain('Beta');
      expect(wrapper.text()).toContain('Gamma');
    });
  });

  // ── 3. Tag Removal ──

  describe('Tag Removal', () => {
    it('clicking the remove button on a tag removes it', async () => {
      const { wrapper, props } = mountEditor({ value: 'Bug, Feature' });

      const removeBtn = wrapper.find('button[aria-label="Remove Bug"]');
      await removeBtn.trigger('click');

      expect(props.onValueChange).toHaveBeenCalledWith('Feature');
    });

    it('removing a tag updates the tag count', async () => {
      const { wrapper } = mountEditor({ value: 'Bug, Feature' });

      const removeBtn = wrapper.find('button[aria-label="Remove Bug"]');
      await removeBtn.trigger('click');

      expect(wrapper.text()).toContain('1 tag');
    });
  });

  // ── 4. Adding Tags via Input ──

  describe('Adding Tags', () => {
    it('typing in the input and pressing Enter adds the tag', async () => {
      const { wrapper, props } = mountEditor({ value: null });

      const input = getTagInput(wrapper);
      await input.setValue('NewTag');
      await input.trigger('input');
      await input.trigger('keydown', { key: 'Enter' });

      expect(props.onValueChange).toHaveBeenCalledWith('NewTag');
    });

    it('pressing Enter with empty input calls onCommit', async () => {
      const { wrapper, props } = mountEditor({ value: 'Bug' });

      const input = getTagInput(wrapper);
      await input.trigger('keydown', { key: 'Enter' });

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('does not add duplicate tags', async () => {
      const { wrapper } = mountEditor({ value: 'Bug' });

      const input = getTagInput(wrapper);
      await input.setValue('Bug');
      await input.trigger('input');
      await input.trigger('keydown', { key: 'Enter' });

      // Should still show only one "Bug" chip (count remains 1)
      expect(wrapper.text()).toContain('1 tag');
    });
  });

  // ── 5. Keyboard Escape ──

  describe('Keyboard', () => {
    it('Escape with no dropdown calls onCancel', async () => {
      const { wrapper, props } = mountEditor({ value: 'Bug' });

      const input = getTagInput(wrapper);
      await input.trigger('keydown', { key: 'Escape' });

      expect(props.onCancel).toHaveBeenCalled();
    });

    it('Backspace with empty input removes last tag', async () => {
      const { wrapper, props } = mountEditor({ value: 'Bug, Feature' });

      const input = getTagInput(wrapper);
      // Ensure input is empty (default)
      await input.trigger('keydown', { key: 'Backspace' });

      // onValueChange should be called with only "Bug" remaining
      expect(props.onValueChange).toHaveBeenCalledWith('Bug');
    });
  });

  // ── 6. Apply/Cancel Buttons ──

  describe('Apply and Cancel Buttons', () => {
    it('clicking Apply calls onCommit', async () => {
      const { wrapper, props } = mountEditor({ value: 'Bug' });
      const applyBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Apply');

      await applyBtn!.trigger('click');

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('clicking Cancel calls onCancel', async () => {
      const { wrapper, props } = mountEditor({ value: 'Bug' });
      const cancelBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Cancel');

      await cancelBtn!.trigger('click');

      expect(props.onCancel).toHaveBeenCalled();
    });
  });

  // ── 7. Suggestions ──

  describe('Suggestions', () => {
    it('shows filtered suggestions when typing matches', async () => {
      const { wrapper } = mountEditor({
        value: null,
        cellEditorParams: { suggestions: ['Bug', 'Feature', 'Documentation'] },
      });

      const input = getTagInput(wrapper);
      await input.setValue('Bug');
      await input.trigger('input');

      // Suggestion dropdown should appear with "Bug"
      expect(wrapper.find('ul').exists()).toBe(true);
      expect(wrapper.text()).toContain('Bug');
    });

    it('does not show already-selected tags in suggestions', async () => {
      const { wrapper } = mountEditor({
        value: 'Bug',
        cellEditorParams: { suggestions: ['Bug', 'Feature'] },
      });

      const input = getTagInput(wrapper);
      await input.setValue('B');
      await input.trigger('input');

      // "Bug" is already selected, so should be excluded from suggestions
      const ul = wrapper.find('ul');
      if (ul.exists()) {
        const suggestionTexts = ul.findAll('li').map((li) => li.text());
        expect(suggestionTexts).not.toContain('Bug');
      }
    });
  });
});
