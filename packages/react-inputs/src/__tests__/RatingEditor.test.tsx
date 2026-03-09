import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RatingEditor } from '../Rating/RatingEditor';
import type { ICellEditorProps } from '@alaarab/ogrid-core';

// ---------- Helpers ----------

type RatingEditorParams = NonNullable<ICellEditorProps<{ id: number }>['cellEditorParams']> & {
  maxStars?: number;
  allowHalf?: boolean;
};

type RatingEditorTestProps = Omit<ICellEditorProps<{ id: number }>, 'cellEditorParams'> & {
  cellEditorParams?: RatingEditorParams;
};

function createMockProps(
  overrides: Partial<RatingEditorTestProps> = {},
): RatingEditorTestProps {
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

function renderEditor(overrides: Partial<RatingEditorTestProps> = {}) {
  const props = createMockProps(overrides);
  const result = render(<RatingEditor {...props} />);
  return { ...result, props };
}

function getStarButtons(): HTMLButtonElement[] {
  return screen.getAllByRole('button').filter(
    (btn) => btn.textContent !== 'Clear',
  ) as HTMLButtonElement[];
}

// ---------- Tests ----------

describe('RatingEditor', () => {
  // ── 1. Rendering ──

  describe('Rendering', () => {
    it('renders without errors', () => {
      expect(() => renderEditor()).not.toThrow();
    });

    it('renders the default 5 star buttons', () => {
      renderEditor();
      const starButtons = getStarButtons();
      expect(starButtons).toHaveLength(5);
    });

    it('renders custom maxStars count', () => {
      renderEditor({ cellEditorParams: { maxStars: 3 } });
      const starButtons = getStarButtons();
      expect(starButtons).toHaveLength(3);
    });

    it('renders a Clear button', () => {
      renderEditor();
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('shows "No rating" label when value is 0', () => {
      renderEditor({ value: 0 });
      expect(screen.getByText('No rating')).toBeInTheDocument();
    });

    it('shows numeric rating label for non-zero value', () => {
      renderEditor({ value: 3 });
      expect(screen.getByText('3 / 5')).toBeInTheDocument();
    });
  });

  // ── 2. Initial Value ──

  describe('Initial Value', () => {
    it('null value shows "No rating"', () => {
      renderEditor({ value: null });
      expect(screen.getByText('No rating')).toBeInTheDocument();
    });

    it('undefined value shows "No rating"', () => {
      renderEditor({ value: undefined });
      expect(screen.getByText('No rating')).toBeInTheDocument();
    });

    it('empty string value shows "No rating"', () => {
      renderEditor({ value: '' });
      expect(screen.getByText('No rating')).toBeInTheDocument();
    });

    it('numeric value is reflected in label', () => {
      renderEditor({ value: 4 });
      expect(screen.getByText('4 / 5')).toBeInTheDocument();
    });

    it('value exceeding maxStars is clamped', () => {
      renderEditor({ value: 10, cellEditorParams: { maxStars: 5 } });
      expect(screen.getByText('5 / 5')).toBeInTheDocument();
    });
  });

  // ── 3. User Interaction  -  Star Click ──

  describe('Star Click', () => {
    it('clicking a star calls onValueChange', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: 0 });
      const starButtons = getStarButtons();

      await user.click(starButtons[0]!);

      expect(props.onValueChange).toHaveBeenCalled();
    });

    it('clicking a star auto-commits via setTimeout', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: 0 });
      const starButtons = getStarButtons();

      await user.click(starButtons[2]!);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(props.onCommit).toHaveBeenCalled();
    });
  });

  // ── 4. Clear Button ──

  describe('Clear Button', () => {
    it('clicking Clear calls onValueChange with empty string', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: 3 });
      await user.click(screen.getByText('Clear'));
      expect(props.onValueChange).toHaveBeenCalledWith('');
    });

    it('clicking Clear calls onCommit', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: 3 });
      await user.click(screen.getByText('Clear'));
      expect(props.onCommit).toHaveBeenCalled();
    });

    it('clicking Clear resets label to "No rating"', async () => {
      const user = userEvent.setup();
      renderEditor({ value: 3 });
      await user.click(screen.getByText('Clear'));
      expect(screen.getByText('No rating')).toBeInTheDocument();
    });
  });

  // ── 5. Keyboard ──

  describe('Keyboard', () => {
    it('Escape key calls onCancel', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: 3 });

      const root = screen.getAllByRole('button')[0]!.closest('div[tabindex]') as HTMLElement;
      root.focus();

      await user.keyboard('{Escape}');

      expect(props.onCancel).toHaveBeenCalled();
    });

    it('Enter key calls onCommit', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: 3 });

      const root = screen.getAllByRole('button')[0]!.closest('div[tabindex]') as HTMLElement;
      root.focus();

      await user.keyboard('{Enter}');

      expect(props.onCommit).toHaveBeenCalled();
    });
  });
});
