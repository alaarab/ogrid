import * as React from 'react';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePickerEditor } from '../DatePicker/DatePickerEditor';
import { MONTH_NAMES, DAY_NAMES, formatDate } from '../DatePicker/calendar-utils';
import type { ICellEditorProps } from '@alaarab/ogrid-core';

// ---------- Helpers ----------

function createMockProps(overrides: Partial<ICellEditorProps<{ id: number }>> = {}): ICellEditorProps<{ id: number }> {
  return {
    value: '2024-03-15',
    onValueChange: jest.fn(),
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    item: { id: 1 },
    column: { columnId: 'date', name: 'Date' },
    ...overrides,
  };
}

function renderEditor(overrides: Partial<ICellEditorProps<{ id: number }>> = {}) {
  const props = createMockProps(overrides);
  const result = render(<DatePickerEditor {...props} />);
  return { ...result, props };
}

// ---------- Tests ----------

describe('DatePickerEditor', () => {
  // ── 1. Rendering ──

  describe('Rendering', () => {
    it('renders calendar grid with correct month/year', () => {
      renderEditor({ value: '2024-03-15' });
      // Header should show "March 2024"
      expect(screen.getByText('March 2024')).toBeInTheDocument();
    });

    it('shows text input with initial value', () => {
      renderEditor({ value: '2024-03-15' });
      const input = screen.getByPlaceholderText('YYYY-MM-DD') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('2024-03-15');
    });

    it('shows "Today" and "Clear" buttons', () => {
      renderEditor();
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('shows day headers (Su, Mo, Tu, We, Th, Fr, Sa)', () => {
      renderEditor();
      for (const dayName of DAY_NAMES) {
        expect(screen.getByText(dayName)).toBeInTheDocument();
      }
    });

    it('renders previous and next month navigation buttons', () => {
      renderEditor();
      expect(screen.getByLabelText('Previous month')).toBeInTheDocument();
      expect(screen.getByLabelText('Next month')).toBeInTheDocument();
    });

    it('renders 42 date cells (6 weeks x 7 days)', () => {
      renderEditor({ value: '2024-03-15' });
      // The grid contains day headers (7) + date cells (42) = 49 buttons total for date cells
      // Date cells are buttons with tabIndex=-1
      const allButtons = screen.getAllByRole('button');
      // Filter out named buttons (Today, Clear, Previous month, Next month)
      const dateCells = allButtons.filter(
        (btn) =>
          btn.getAttribute('aria-label') !== 'Previous month' &&
          btn.getAttribute('aria-label') !== 'Next month' &&
          btn.textContent !== 'Today' &&
          btn.textContent !== 'Clear'
      );
      expect(dateCells).toHaveLength(42);
    });
  });

  // ── 2. Date Selection ──

  describe('Date Selection', () => {
    it('clicking a date cell calls onValueChange then onCommit', async () => {
      const { props } = renderEditor({ value: '2024-03-15' });

      // Click on March 10
      const allButtons = screen.getAllByRole('button');
      const dateCells = allButtons.filter(
        (btn) =>
          btn.getAttribute('aria-label') !== 'Previous month' &&
          btn.getAttribute('aria-label') !== 'Next month' &&
          btn.textContent !== 'Today' &&
          btn.textContent !== 'Clear'
      );
      // Find the button for day 10 that is in the current month (March 2024)
      // March 2024 starts on Friday, so day 10 is the second week
      const day10 = dateCells.find((btn) => btn.textContent === '10');
      expect(day10).toBeDefined();

      await act(async () => {
        day10!.click();
      });

      expect(props.onValueChange).toHaveBeenCalledWith('2024-03-10');

      // onCommit is called via setTimeout(0)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('selected date shows the correct value in the input after click', async () => {
      renderEditor({ value: '2024-03-15' });

      // Click day 20
      const allButtons = screen.getAllByRole('button');
      const dateCells = allButtons.filter(
        (btn) =>
          btn.getAttribute('aria-label') !== 'Previous month' &&
          btn.getAttribute('aria-label') !== 'Next month' &&
          btn.textContent !== 'Today' &&
          btn.textContent !== 'Clear'
      );
      // Find day 20 that belongs to current month. There could be multiple "20"s
      // (one from adjacent month), so we pick the one that is in the current month.
      // For March 2024, day 20 will be a current-month day.
      const day20Candidates = dateCells.filter((btn) => btn.textContent === '20');
      // The current-month one won't have the dimmed color
      const day20 = day20Candidates[0];

      await act(async () => {
        day20!.click();
      });

      const input = screen.getByPlaceholderText('YYYY-MM-DD') as HTMLInputElement;
      expect(input.value).toBe('2024-03-20');
    });
  });

  // ── 3. Text Input ──

  describe('Text Input', () => {
    it('typing a valid date updates the calendar view', async () => {
      const user = userEvent.setup();
      renderEditor({ value: '2024-03-15' });

      const input = screen.getByPlaceholderText('YYYY-MM-DD');
      // Clear and type a new date
      await user.clear(input);
      await user.type(input, '2024-06-20');

      // Calendar should now show June 2024
      expect(screen.getByText('June 2024')).toBeInTheDocument();
    });

    it('pressing Enter commits the value', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '2024-03-15' });

      const input = screen.getByPlaceholderText('YYYY-MM-DD');
      await user.clear(input);
      await user.type(input, '2024-05-01');
      await user.keyboard('{Enter}');

      expect(props.onValueChange).toHaveBeenCalledWith('2024-05-01');
      expect(props.onCommit).toHaveBeenCalled();
    });

    it('pressing Escape cancels', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '2024-03-15' });

      const input = screen.getByPlaceholderText('YYYY-MM-DD');
      await user.type(input, '2024-05-01');
      await user.keyboard('{Escape}');

      expect(props.onCancel).toHaveBeenCalled();
    });

    it('typing an invalid date does not update the calendar view', async () => {
      const user = userEvent.setup();
      renderEditor({ value: '2024-03-15' });

      const input = screen.getByPlaceholderText('YYYY-MM-DD');
      await user.clear(input);
      await user.type(input, 'not-a-date');

      // Calendar should still show March 2024 (the initial view)
      expect(screen.getByText('March 2024')).toBeInTheDocument();
    });
  });

  // ── 4. Navigation ──

  describe('Navigation', () => {
    it('previous month button navigates back', async () => {
      const user = userEvent.setup();
      renderEditor({ value: '2024-03-15' });

      expect(screen.getByText('March 2024')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Previous month'));

      expect(screen.getByText('February 2024')).toBeInTheDocument();
    });

    it('next month button navigates forward', async () => {
      const user = userEvent.setup();
      renderEditor({ value: '2024-03-15' });

      expect(screen.getByText('March 2024')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Next month'));

      expect(screen.getByText('April 2024')).toBeInTheDocument();
    });

    it('navigating from January goes to December of previous year', async () => {
      const user = userEvent.setup();
      renderEditor({ value: '2024-01-15' });

      expect(screen.getByText('January 2024')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Previous month'));

      expect(screen.getByText('December 2023')).toBeInTheDocument();
    });

    it('navigating from December goes to January of next year', async () => {
      const user = userEvent.setup();
      renderEditor({ value: '2024-12-15' });

      expect(screen.getByText('December 2024')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Next month'));

      expect(screen.getByText('January 2025')).toBeInTheDocument();
    });

    it('can navigate multiple months in sequence', async () => {
      const user = userEvent.setup();
      renderEditor({ value: '2024-06-15' });

      expect(screen.getByText('June 2024')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Next month'));
      expect(screen.getByText('July 2024')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Next month'));
      expect(screen.getByText('August 2024')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Previous month'));
      expect(screen.getByText('July 2024')).toBeInTheDocument();
    });
  });

  // ── 5. Today Button ──

  describe('Today Button', () => {
    it('clicking "Today" selects today\'s date and commits', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '2024-03-15' });

      await user.click(screen.getByText('Today'));

      const today = new Date();
      const expectedDate = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

      expect(props.onValueChange).toHaveBeenCalledWith(expectedDate);

      // onCommit called via setTimeout(0)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('clicking "Today" updates the input text', async () => {
      const user = userEvent.setup();
      renderEditor({ value: '2024-03-15' });

      await user.click(screen.getByText('Today'));

      const today = new Date();
      const expectedDate = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

      const input = screen.getByPlaceholderText('YYYY-MM-DD') as HTMLInputElement;
      expect(input.value).toBe(expectedDate);
    });
  });

  // ── 6. Clear Button ──

  describe('Clear Button', () => {
    it('clicking "Clear" commits empty string', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '2024-03-15' });

      await user.click(screen.getByText('Clear'));

      expect(props.onValueChange).toHaveBeenCalledWith('');
      expect(props.onCommit).toHaveBeenCalled();
    });

    it('clicking "Clear" clears the input text', async () => {
      const user = userEvent.setup();
      renderEditor({ value: '2024-03-15' });

      await user.click(screen.getByText('Clear'));

      const input = screen.getByPlaceholderText('YYYY-MM-DD') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  // ── 7. Initial Value ──

  describe('Initial Value', () => {
    it('null value shows current month', () => {
      renderEditor({ value: null });

      const today = new Date();
      const expectedHeader = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
      expect(screen.getByText(expectedHeader)).toBeInTheDocument();
    });

    it('undefined value shows current month', () => {
      renderEditor({ value: undefined });

      const today = new Date();
      const expectedHeader = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
      expect(screen.getByText(expectedHeader)).toBeInTheDocument();
    });

    it('valid date string shows that month', () => {
      renderEditor({ value: '2023-09-25' });

      expect(screen.getByText('September 2023')).toBeInTheDocument();
    });

    it('invalid value falls back to current month', () => {
      renderEditor({ value: 'invalid-date' });

      const today = new Date();
      const expectedHeader = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
      expect(screen.getByText(expectedHeader)).toBeInTheDocument();
    });

    it('null value shows empty input', () => {
      renderEditor({ value: null });

      const input = screen.getByPlaceholderText('YYYY-MM-DD') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('valid date shows formatted date in input', () => {
      renderEditor({ value: '2024-01-05' });

      const input = screen.getByPlaceholderText('YYYY-MM-DD') as HTMLInputElement;
      expect(input.value).toBe('2024-01-05');
    });

    it('numeric value is coerced to string and parsed', () => {
      // The component does String(value), so a number like 20240315 would be "20240315"
      // which is not valid YYYY-MM-DD, so it should fall back to current month
      renderEditor({ value: 20240315 });

      const today = new Date();
      const expectedHeader = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
      expect(screen.getByText(expectedHeader)).toBeInTheDocument();
    });
  });

  // ── 8. Focus ──

  describe('Focus', () => {
    it('input is focused on mount', () => {
      renderEditor({ value: '2024-03-15' });

      const input = screen.getByPlaceholderText('YYYY-MM-DD');
      expect(document.activeElement).toBe(input);
    });

    it('input text is selected on mount', () => {
      renderEditor({ value: '2024-03-15' });

      const input = screen.getByPlaceholderText('YYYY-MM-DD') as HTMLInputElement;
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe('2024-03-15'.length);
    });
  });
});
