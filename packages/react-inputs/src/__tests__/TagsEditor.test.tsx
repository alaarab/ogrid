import * as React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagsEditor } from '../Tags/TagsEditor';
import type { ICellEditorProps } from '@alaarab/ogrid-core';

// ---------- Helpers ----------

function createMockProps(
  overrides: Partial<ICellEditorProps<{ id: number }>> = {},
): ICellEditorProps<{ id: number }> {
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

function renderEditor(overrides: Partial<ICellEditorProps<{ id: number }>> = {}) {
  const props = createMockProps(overrides);
  const result = render(<TagsEditor {...props} />);
  return { ...result, props };
}

function getTagInput(): HTMLInputElement {
  return screen.getByRole('textbox') as HTMLInputElement;
}

// ---------- Tests ----------

describe('TagsEditor', () => {
  // ── 1. Rendering ──

  describe('Rendering', () => {
    it('renders without errors', () => {
      expect(() => renderEditor()).not.toThrow();
    });

    it('renders tags from initial comma-separated string value', () => {
      renderEditor({ value: 'Bug, Feature' });
      expect(screen.getByText('Bug')).toBeInTheDocument();
      expect(screen.getByText('Feature')).toBeInTheDocument();
    });

    it('renders a text input for tag entry', () => {
      renderEditor();
      expect(getTagInput()).toBeInTheDocument();
    });

    it('renders a "Clear all" button', () => {
      renderEditor();
      expect(screen.getByText('Clear all')).toBeInTheDocument();
    });

    it('shows tag count in footer', () => {
      renderEditor({ value: 'Bug, Feature' });
      expect(screen.getByText('2 tags')).toBeInTheDocument();
    });

    it('shows singular "tag" when only one tag exists', () => {
      renderEditor({ value: 'Bug' });
      expect(screen.getByText('1 tag')).toBeInTheDocument();
    });

    it('shows "No tags" placeholder when no tags exist', () => {
      renderEditor({ value: null });
      expect(screen.getByText('No tags')).toBeInTheDocument();
    });

    it('renders the Apply button by default', () => {
      renderEditor();
      expect(screen.getByRole('button', { name: 'Apply tags' })).toBeInTheDocument();
    });

    it('does not render the Apply button when showApplyButton is false', () => {
      renderEditor({ cellEditorParams: { showApplyButton: false } });
      expect(screen.queryByRole('button', { name: 'Apply tags' })).not.toBeInTheDocument();
    });
  });

  // ── 2. Initial Value ──

  describe('Initial Value', () => {
    it('null value renders "No tags"', () => {
      renderEditor({ value: null });
      expect(screen.getByText('No tags')).toBeInTheDocument();
    });

    it('undefined value renders "No tags"', () => {
      renderEditor({ value: undefined });
      expect(screen.getByText('No tags')).toBeInTheDocument();
    });

    it('empty string value renders "No tags"', () => {
      renderEditor({ value: '' });
      expect(screen.getByText('No tags')).toBeInTheDocument();
    });

    it('array value is parsed into individual tags', () => {
      renderEditor({ value: ['Alpha', 'Beta', 'Gamma'] });
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.getByText('Gamma')).toBeInTheDocument();
    });
  });

  // ── 3. Tag Removal ──

  describe('Tag Removal', () => {
    it('clicking the remove button on a tag removes it', () => {
      const { props } = renderEditor({ value: 'Bug, Feature' });

      const removeBugBtn = screen.getByLabelText('Remove Bug');
      removeBugBtn.click();

      expect(props.onValueChange).toHaveBeenCalledWith('Feature');
    });

    it('removing a tag updates the tag count', async () => {
      renderEditor({ value: 'Bug, Feature' });

      await act(async () => {
        screen.getByLabelText('Remove Bug').click();
      });

      expect(screen.getByText('1 tag')).toBeInTheDocument();
    });
  });

  // ── 4. Adding Tags ──

  describe('Adding Tags', () => {
    it('typing in the input and pressing Enter adds the tag', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: null });

      const input = getTagInput();
      await user.type(input, 'NewTag');
      await user.keyboard('{Enter}');

      expect(props.onValueChange).toHaveBeenCalledWith('NewTag');
    });

    it('pressing comma adds the current tag', async () => {
      const user = userEvent.setup();
      renderEditor({ value: null });

      const input = getTagInput();
      await user.type(input, 'NewTag,');

      expect(screen.getByText('NewTag')).toBeInTheDocument();
    });

    it('pressing Enter with empty input calls onCommit', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: 'Bug' });

      const input = getTagInput();
      await user.click(input);
      await user.keyboard('{Enter}');

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('does not add duplicate tags', async () => {
      const user = userEvent.setup();
      renderEditor({ value: 'Bug' });

      const input = getTagInput();
      await user.type(input, 'Bug');
      await user.keyboard('{Enter}');

      // Still only one "Bug" tag
      expect(screen.getAllByText('Bug')).toHaveLength(1);
    });
  });

  // ── 5. Suggestions ──

  describe('Suggestions', () => {
    it('shows filtered suggestions when typing matches', async () => {
      const user = userEvent.setup();
      renderEditor({
        value: null,
        cellEditorParams: { suggestions: ['Bug', 'Feature', 'Documentation'] },
      });

      const input = getTagInput();
      await user.type(input, 'Bug');

      expect(screen.getByText('Bug')).toBeInTheDocument();
    });

    it('suggestion dropdown does not show when query is empty (allowCreate mode)', () => {
      renderEditor({
        value: null,
        cellEditorParams: { suggestions: ['Bug', 'Feature'], allowCreate: true },
      });
      // With empty input in allowCreate mode, suggestions list should not render
      expect(screen.queryByText('Bug')).not.toBeInTheDocument();
    });
  });

  // ── 6. Clear All Button ──

  describe('Clear All', () => {
    it('clicking Clear all calls onValueChange with empty string', () => {
      const { props } = renderEditor({ value: 'Bug, Feature' });
      screen.getByText('Clear all').click();
      expect(props.onValueChange).toHaveBeenCalledWith('');
    });

    it('clicking Clear all does not call onCommit when showApplyButton is true (default)', () => {
      const { props } = renderEditor({ value: 'Bug, Feature' });
      screen.getByText('Clear all').click();
      expect(props.onCommit).not.toHaveBeenCalled();
    });

    it('clicking Clear all calls onCommit when showApplyButton is false', () => {
      const { props } = renderEditor({
        value: 'Bug, Feature',
        cellEditorParams: { showApplyButton: false },
      });
      screen.getByText('Clear all').click();
      expect(props.onCommit).toHaveBeenCalled();
    });

    it('clicking Clear all removes all tags from display', async () => {
      renderEditor({ value: 'Bug, Feature' });
      await act(async () => {
        screen.getByText('Clear all').click();
      });
      expect(screen.getByText('No tags')).toBeInTheDocument();
    });
  });

  // ── 7. Keyboard ──

  describe('Keyboard', () => {
    it('Escape key calls onCancel', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: 'Bug' });

      const input = getTagInput();
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(props.onCancel).toHaveBeenCalled();
    });

    it('Backspace with empty input removes the last tag', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: 'Bug, Feature' });

      const input = getTagInput();
      await user.click(input);
      await user.keyboard('{Backspace}');

      expect(props.onValueChange).toHaveBeenCalledWith('Bug');
    });
  });

  // ── 8. Apply Button ──

  describe('Apply Button', () => {
    it('clicking Apply calls onCommit', () => {
      const { props } = renderEditor({ value: 'Bug' });
      screen.getByRole('button', { name: 'Apply tags' }).click();
      expect(props.onCommit).toHaveBeenCalled();
    });

    it('clicking Apply does not clear tags', async () => {
      renderEditor({ value: 'Bug, Feature' });
      await act(async () => {
        screen.getByRole('button', { name: 'Apply tags' }).click();
      });
      expect(screen.getByText('Bug')).toBeInTheDocument();
      expect(screen.getByText('Feature')).toBeInTheDocument();
    });
  });

  // ── 9. Multi-Select Mode (allowCreate: false + suggestions) ──

  describe('Multi-Select Mode', () => {
    const multiSelectProps = {
      value: null,
      cellEditorParams: {
        suggestions: ['Bug', 'Feature', 'Docs'],
        allowCreate: false,
      },
    };

    it('shows all suggestions by default when allowCreate is false', () => {
      renderEditor(multiSelectProps);
      expect(screen.getByText('Bug')).toBeInTheDocument();
      expect(screen.getByText('Feature')).toBeInTheDocument();
      expect(screen.getByText('Docs')).toBeInTheDocument();
    });

    it('shows checkboxes next to each suggestion in multi-select mode', () => {
      renderEditor(multiSelectProps);
      // All suggestions should be visible
      expect(screen.getByText('Bug')).toBeInTheDocument();
    });

    it('clicking a suggestion in multi-select mode selects it (adds as tag)', async () => {
      const { props } = renderEditor(multiSelectProps);
      await act(async () => {
        screen.getByText('Bug').click();
      });
      expect(props.onValueChange).toHaveBeenCalledWith('Bug');
    });

    it('clicking a selected tag in the dropdown deselects it (removes the tag)', async () => {
      const { props } = renderEditor({
        value: 'Bug',
        cellEditorParams: { suggestions: ['Bug', 'Feature'], allowCreate: false },
      });

      // Bug is already selected — it appears both as a chip and in the dropdown list.
      // Click the dropdown item (the flex:1 span inside the suggestion row).
      const allBugTexts = screen.getAllByText('Bug');
      // The dropdown item text span has flex:1 style, the chip has text-overflow style
      // Click the last one which is in the suggestions list
      await act(async () => {
        allBugTexts[allBugTexts.length - 1].click();
      });

      expect(props.onValueChange).toHaveBeenCalledWith('');
    });

    it('filters suggestions in multi-select mode when typing', async () => {
      const user = userEvent.setup();
      renderEditor(multiSelectProps);

      await user.type(getTagInput(), 'Bug');

      expect(screen.getByText('Bug')).toBeInTheDocument();
      expect(screen.queryByText('Feature')).not.toBeInTheDocument();
    });

    it('does not allow free-form tag creation when allowCreate is false', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor(multiSelectProps);

      await user.type(getTagInput(), 'NewCustomTag');
      await user.keyboard('{Enter}');

      // No tag should have been added (onValueChange should not have been called with NewCustomTag)
      const calls = (props.onValueChange as jest.Mock).mock.calls;
      const addedNewTag = calls.some((c) => String(c[0]).includes('NewCustomTag'));
      expect(addedNewTag).toBe(false);
    });
  });

  // ── 10. Predefined Tags (allowCreate: false) ──

  describe('Predefined Tags', () => {
    it('does not add tags that are not in suggestions when allowCreate is false', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({
        value: null,
        cellEditorParams: {
          suggestions: ['Bug', 'Feature'],
          allowCreate: false,
        },
      });

      // allowCreate: false but suggestions provided — clicking "Bug" in dropdown works
      await act(async () => {
        screen.getByText('Bug').click();
      });

      expect(props.onValueChange).toHaveBeenCalledWith('Bug');
    });
  });
});
