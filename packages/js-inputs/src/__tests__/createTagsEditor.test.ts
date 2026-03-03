import { createTagsEditor, TagsEditorContext } from '../Tags/createTagsEditor';

// ---------- Helpers ----------

function createMockContext(value: unknown = null): TagsEditorContext {
  return {
    value,
    onValueChange: jest.fn(),
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    item: {},
    column: { columnId: 'labels', name: 'Labels' } as any,
    cell: document.createElement('td'),
  };
}

function renderEditor(
  value: unknown = null,
  cellEditorParams?: Record<string, unknown>,
): { root: HTMLElement; context: TagsEditorContext } {
  const context = createMockContext(value);
  if (cellEditorParams) {
    context.cellEditorParams = cellEditorParams;
  }
  const root = createTagsEditor(context);
  document.body.appendChild(root);
  return { root, context };
}

function getSearchInput(root: HTMLElement): HTMLInputElement {
  return root.querySelector('input[type="text"]') as HTMLInputElement;
}

function clickButtonByText(root: HTMLElement, text: string): void {
  const allButtons = Array.from(root.querySelectorAll('button'));
  const btn = allButtons.find((b) => b.textContent === text);
  if (btn) btn.click();
}

function fireKeydown(element: HTMLElement, key: string): void {
  element.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
}

// ---------- Tests ----------

describe('createTagsEditor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ── 1. Return type ──

  describe('Return type', () => {
    it('returns an HTMLElement', () => {
      const context = createMockContext('Bug, Feature');
      const result = createTagsEditor(context);
      expect(result).toBeInstanceOf(HTMLElement);
    });
  });

  // ── 2. Search input ──

  describe('Search input', () => {
    it('renders a search input element', () => {
      const { root } = renderEditor('Bug');
      expect(getSearchInput(root)).not.toBeNull();
    });

    it('input has appropriate placeholder when allowCreate is true (default)', () => {
      const { root } = renderEditor(null);
      const input = getSearchInput(root);
      expect(input.placeholder).toContain('Search or add tag');
    });

    it('input has different placeholder when allowCreate is false', () => {
      const { root } = renderEditor(null, { allowCreate: false });
      const input = getSearchInput(root);
      expect(input.placeholder).toContain('Search tags');
    });
  });

  // ── 3. Initial tags ──

  describe('Initial tags', () => {
    it('renders tag chips from initial comma-separated value', () => {
      const { root } = renderEditor('Bug, Feature');
      expect(root.textContent).toContain('Bug');
      expect(root.textContent).toContain('Feature');
    });

    it('null value shows "No tags yet" placeholder', () => {
      const { root } = renderEditor(null);
      expect(root.textContent).toContain('No tags yet');
    });

    it('empty string shows "No tags yet" placeholder', () => {
      const { root } = renderEditor('');
      expect(root.textContent).toContain('No tags yet');
    });

    it('has remove buttons for each initial tag', () => {
      const { root } = renderEditor('Bug, Feature');
      const removeBugBtn = root.querySelector('button[aria-label="Remove Bug"]');
      const removeFeatureBtn = root.querySelector('button[aria-label="Remove Feature"]');
      expect(removeBugBtn).not.toBeNull();
      expect(removeFeatureBtn).not.toBeNull();
    });
  });

  // ── 4. Tag removal ──

  describe('Tag removal', () => {
    it('clicking the remove button calls onValueChange without that tag', () => {
      const { root, context } = renderEditor('Bug, Feature');
      const removeBugBtn = root.querySelector('button[aria-label="Remove Bug"]') as HTMLButtonElement;

      removeBugBtn.click();

      expect(context.onValueChange).toHaveBeenCalledWith('Feature');
    });

    it('removing the last tag calls onValueChange with empty string', () => {
      const { root, context } = renderEditor('Bug');
      const removeBugBtn = root.querySelector('button[aria-label="Remove Bug"]') as HTMLButtonElement;

      removeBugBtn.click();

      expect(context.onValueChange).toHaveBeenCalledWith('');
    });
  });

  // ── 5. Adding tags via input ──

  describe('Adding tags via input', () => {
    it('pressing Enter with text in input adds the tag', () => {
      const { root, context } = renderEditor(null);
      const input = getSearchInput(root);

      input.value = 'NewTag';
      fireKeydown(input, 'Enter');

      expect(context.onValueChange).toHaveBeenCalledWith('NewTag');
    });

    it('pressing Enter with empty input calls onCommit', () => {
      const { root, context } = renderEditor('Bug');
      const input = getSearchInput(root);

      // Input is empty by default
      fireKeydown(input, 'Enter');

      expect(context.onCommit).toHaveBeenCalled();
    });

    it('pressing Backspace with empty input removes last tag', () => {
      const { root, context } = renderEditor('Bug, Feature');
      const input = getSearchInput(root);

      fireKeydown(input, 'Backspace');

      expect(context.onValueChange).toHaveBeenCalledWith('Bug');
    });

    it('does not add duplicate tags', () => {
      const { root, context } = renderEditor('Bug');
      const input = getSearchInput(root);

      input.value = 'Bug';
      fireKeydown(input, 'Enter');

      // Should not call onValueChange for the duplicate
      expect(context.onValueChange).not.toHaveBeenCalled();
    });
  });

  // ── 6. Add button (when allowCreate is true) ──

  describe('Add button', () => {
    it('renders an Add button when allowCreate is true (default)', () => {
      const { root } = renderEditor(null);
      const allButtons = Array.from(root.querySelectorAll('button'));
      const addBtn = allButtons.find((b) => b.textContent === 'Add');
      expect(addBtn).toBeDefined();
    });

    it('does not render Add button when allowCreate is false', () => {
      const { root } = renderEditor(null, { allowCreate: false });
      const allButtons = Array.from(root.querySelectorAll('button'));
      const addBtn = allButtons.find((b) => b.textContent === 'Add');
      expect(addBtn).toBeUndefined();
    });

    it('clicking Add button with text adds the tag', () => {
      const { root, context } = renderEditor(null);
      const input = getSearchInput(root);
      input.value = 'Design';

      clickButtonByText(root, 'Add');

      expect(context.onValueChange).toHaveBeenCalledWith('Design');
    });
  });

  // ── 7. Suggestions ──

  describe('Suggestions', () => {
    it('shows suggestions when suggestions param is provided', () => {
      const { root } = renderEditor(null, { suggestions: ['Bug', 'Feature', 'Docs'] });
      // Suggestions render immediately if no tags yet (renderSuggestions(''))
      const suggestionsBox = root.querySelector('div[style*="overflow"]');
      // Depending on display, check if suggestions box is visible
      expect(suggestionsBox).not.toBeNull();
    });

    it('filters suggestions from input text', () => {
      const { root } = renderEditor(null, { suggestions: ['Bug', 'Feature', 'Documentation'] });
      const input = getSearchInput(root);

      input.value = 'Bug';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(root.textContent).toContain('Bug');
    });
  });

  // ── 8. Clear all button ──

  describe('Clear all button', () => {
    it('has a "Clear all" button', () => {
      const { root } = renderEditor('Bug, Feature');
      const allButtons = Array.from(root.querySelectorAll('button'));
      const clearBtn = allButtons.find((b) => b.textContent === 'Clear all');
      expect(clearBtn).toBeDefined();
    });

    it('clicking "Clear all" calls onValueChange with empty string', () => {
      const { root, context } = renderEditor('Bug, Feature');
      clickButtonByText(root, 'Clear all');
      expect(context.onValueChange).toHaveBeenCalledWith('');
    });
  });

  // ── 9. Done button ──

  describe('Done button', () => {
    it('has a "Done" button', () => {
      const { root } = renderEditor('Bug');
      const allButtons = Array.from(root.querySelectorAll('button'));
      const doneBtn = allButtons.find((b) => b.textContent === 'Done');
      expect(doneBtn).toBeDefined();
    });

    it('clicking "Done" calls onValueChange and onCommit', () => {
      const { root, context } = renderEditor('Bug, Feature');
      clickButtonByText(root, 'Done');
      expect(context.onValueChange).toHaveBeenCalledWith('Bug, Feature');
      expect(context.onCommit).toHaveBeenCalled();
    });
  });

  // ── 10. Keyboard: Escape ──

  describe('Keyboard: Escape', () => {
    it('pressing Escape in the search input calls onCancel', () => {
      const { root, context } = renderEditor('Bug');
      const input = getSearchInput(root);

      fireKeydown(input, 'Escape');

      expect(context.onCancel).toHaveBeenCalled();
    });

    it('pressing Escape on root calls onCancel', () => {
      const { root, context } = renderEditor('Bug');

      fireKeydown(root, 'Escape');

      expect(context.onCancel).toHaveBeenCalled();
    });
  });
});
