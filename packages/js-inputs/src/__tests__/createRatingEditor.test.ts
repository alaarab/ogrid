import { createRatingEditor, RatingEditorContext } from '../Rating/createRatingEditor';

// ---------- Helpers ----------

function createMockContext(value: unknown = null): RatingEditorContext {
  return {
    value,
    onValueChange: jest.fn(),
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    item: {},
    column: { columnId: 'rating', name: 'Rating' } as any,
    cell: document.createElement('td'),
  };
}

function renderEditor(
  value: unknown = null,
  cellEditorParams?: Record<string, unknown>,
): { root: HTMLElement; context: RatingEditorContext } {
  const context = createMockContext(value);
  if (cellEditorParams) {
    context.cellEditorParams = cellEditorParams;
  }
  const root = createRatingEditor(context);
  document.body.appendChild(root);
  return { root, context };
}

function getStarButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll('button')).filter(
    (btn) => btn.textContent !== 'Clear' && btn.textContent !== 'Cancel',
  ) as HTMLButtonElement[];
}

function clickButtonByText(root: HTMLElement, text: string): void {
  const allButtons = Array.from(root.querySelectorAll('button'));
  const btn = allButtons.find((b) => b.textContent === text);
  if (btn) btn.click();
}

// ---------- Tests ----------

describe('createRatingEditor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ── 1. Return type ──

  describe('Return type', () => {
    it('returns an HTMLElement', () => {
      const context = createMockContext(3);
      const result = createRatingEditor(context);
      expect(result).toBeInstanceOf(HTMLElement);
    });
  });

  // ── 2. Star buttons ──

  describe('Star buttons', () => {
    it('renders 5 star buttons by default', () => {
      const { root } = renderEditor(3);
      expect(getStarButtons(root)).toHaveLength(5);
    });

    it('renders custom maxStars count', () => {
      const { root } = renderEditor(3, { maxStars: 3 });
      expect(getStarButtons(root)).toHaveLength(3);
    });

    it('each star button has an aria-label', () => {
      const { root } = renderEditor(0);
      const starButtons = getStarButtons(root);
      for (const btn of starButtons) {
        expect(btn.getAttribute('aria-label')).toBeTruthy();
      }
    });
  });

  // ── 3. Initial value display ──

  describe('Initial value display', () => {
    it('shows " - " value display for rating 0', () => {
      const { root } = renderEditor(0);
      // The value display shows " - " when rating is 0
      expect(root.textContent).toContain(' - ');
    });

    it('shows "X / maxStars" for non-zero rating', () => {
      const { root } = renderEditor(3);
      expect(root.textContent).toContain('3 / 5');
    });

    it('null value shows " - "', () => {
      const { root } = renderEditor(null);
      expect(root.textContent).toContain(' - ');
    });

    it('value exceeding maxStars is clamped', () => {
      const { root } = renderEditor(10, { maxStars: 5 });
      expect(root.textContent).toContain('5 / 5');
    });
  });

  // ── 4. Star click  -  calls onValueChange and onCommit ──

  describe('Star click', () => {
    it('clicking a star calls onValueChange', async () => {
      const { root, context } = renderEditor(0);
      const starButtons = getStarButtons(root);

      starButtons[0]!.click();

      expect(context.onValueChange).toHaveBeenCalled();
    });

    it('clicking a star auto-commits via setTimeout', async () => {
      const { root, context } = renderEditor(0);
      const starButtons = getStarButtons(root);

      starButtons[2]!.click();

      await new Promise((r) => setTimeout(r, 10));

      expect(context.onCommit).toHaveBeenCalled();
    });

    it('clicking the same star again toggles rating off (to 0)', async () => {
      const { root, context } = renderEditor(1);
      const starButtons = getStarButtons(root);

      // Click star 0 (value = 1) when current is already 1  to  toggles to 0
      starButtons[0]!.click();

      expect(context.onValueChange).toHaveBeenCalledWith(0);
    });
  });

  // ── 5. Clear button ──

  describe('Clear button', () => {
    it('has a Clear button', () => {
      const { root } = renderEditor(3);
      const allButtons = Array.from(root.querySelectorAll('button'));
      const clearBtn = allButtons.find((b) => b.textContent === 'Clear');
      expect(clearBtn).toBeDefined();
    });

    it('clicking Clear calls onValueChange with 0', () => {
      const { root, context } = renderEditor(3);
      clickButtonByText(root, 'Clear');
      expect(context.onValueChange).toHaveBeenCalledWith(0);
    });

    it('clicking Clear calls onCommit', () => {
      const { root, context } = renderEditor(3);
      clickButtonByText(root, 'Clear');
      expect(context.onCommit).toHaveBeenCalled();
    });
  });

  // ── 6. Cancel button ──

  describe('Cancel button', () => {
    it('has a Cancel button', () => {
      const { root } = renderEditor(3);
      const allButtons = Array.from(root.querySelectorAll('button'));
      const cancelBtn = allButtons.find((b) => b.textContent === 'Cancel');
      expect(cancelBtn).toBeDefined();
    });

    it('clicking Cancel calls onCancel', () => {
      const { root, context } = renderEditor(3);
      clickButtonByText(root, 'Cancel');
      expect(context.onCancel).toHaveBeenCalled();
    });
  });

  // ── 7. Keyboard: Escape ──

  describe('Keyboard: Escape', () => {
    it('pressing Escape on root calls onCancel', () => {
      const { root, context } = renderEditor(3);

      root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );

      expect(context.onCancel).toHaveBeenCalled();
    });
  });

  // ── 8. Label row ──

  describe('Label row', () => {
    it('root contains a "Rating" header label', () => {
      const { root } = renderEditor(0);
      expect(root.textContent).toContain('Rating');
    });
  });
});
