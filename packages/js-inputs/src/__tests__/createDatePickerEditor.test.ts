import { createDatePickerEditor, DatePickerEditorContext } from '../DatePicker/createDatePickerEditor';
import { MONTH_NAMES, formatDate } from '@alaarab/ogrid-inputs';

// ---------- Helpers ----------

function createMockContext(value: unknown = null): DatePickerEditorContext {
  return {
    value,
    onValueChange: jest.fn(),
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    item: {},
    column: { columnId: 'date', name: 'Date' } as any,
    cell: document.createElement('td'),
  };
}

function renderEditor(value: unknown = null): { root: HTMLElement; context: DatePickerEditorContext } {
  const context = createMockContext(value);
  const root = createDatePickerEditor(context);
  document.body.appendChild(root);
  return { root, context };
}

function getInput(root: HTMLElement): HTMLInputElement {
  return root.querySelector('input[placeholder="YYYY-MM-DD"]') as HTMLInputElement;
}

function getAllDateButtons(root: HTMLElement): HTMLButtonElement[] {
  const allButtons = Array.from(root.querySelectorAll('button'));
  return allButtons.filter(
    (btn) =>
      btn.getAttribute('aria-label') !== 'Previous month' &&
      btn.getAttribute('aria-label') !== 'Next month' &&
      btn.textContent !== 'Today' &&
      btn.textContent !== 'Clear'
  ) as HTMLButtonElement[];
}

function getHeaderTitle(root: HTMLElement): string {
  // The header title is a <span> with fontWeight 600
  const spans = Array.from(root.querySelectorAll('span'));
  const titleSpan = spans.find((s) => s.style.fontWeight === '600' && s.style.fontSize === '14px');
  return titleSpan?.textContent ?? '';
}

function clickButton(root: HTMLElement, label: string): void {
  const btn = root.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
  if (btn) btn.click();
}

function clickButtonByText(root: HTMLElement, text: string): void {
  const allButtons = Array.from(root.querySelectorAll('button'));
  const btn = allButtons.find((b) => b.textContent === text);
  if (btn) btn.click();
}

// ---------- Tests ----------

describe('createDatePickerEditor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // -- 1. Returns an HTMLElement --
  describe('Return type', () => {
    it('returns an HTMLElement', () => {
      const context = createMockContext('2024-03-15');
      const result = createDatePickerEditor(context);
      expect(result).toBeInstanceOf(HTMLElement);
    });
  });

  // -- 2. Contains a text input with correct placeholder --
  describe('Input element', () => {
    it('contains a text input with placeholder YYYY-MM-DD', () => {
      const { root } = renderEditor('2024-03-15');
      const input = getInput(root);
      expect(input).not.toBeNull();
      expect(input.placeholder).toBe('YYYY-MM-DD');
      expect(input.type).toBe('text');
    });
  });

  // -- 3. Input shows initial date value --
  describe('Initial date value', () => {
    it('shows the initial date value in the input', () => {
      const { root } = renderEditor('2024-03-15');
      const input = getInput(root);
      expect(input.value).toBe('2024-03-15');
    });

    it('shows the correct month/year header for the initial value', () => {
      const { root } = renderEditor('2024-03-15');
      expect(getHeaderTitle(root)).toBe('March 2024');
    });
  });

  // -- 4. Clicking a date button calls onValueChange + onCommit --
  describe('Date selection', () => {
    it('clicking a date button calls onValueChange and then onCommit', async () => {
      const { root, context } = renderEditor('2024-03-15');
      const dateButtons = getAllDateButtons(root);

      // Find button for day 10 (exists in March 2024)
      const day10 = dateButtons.find((btn) => btn.textContent === '10');
      expect(day10).toBeDefined();

      day10!.click();

      expect(context.onValueChange).toHaveBeenCalledWith('2024-03-10');

      // onCommit is called via setTimeout(0)
      await new Promise((r) => setTimeout(r, 10));

      expect(context.onCommit).toHaveBeenCalled();
    });

    it('clicking a date updates the input value', () => {
      const { root } = renderEditor('2024-03-15');
      const dateButtons = getAllDateButtons(root);
      const day20 = dateButtons.find((btn) => btn.textContent === '20');
      day20!.click();

      const input = getInput(root);
      expect(input.value).toBe('2024-03-20');
    });
  });

  // -- 5. Typing Enter in input commits --
  describe('Keyboard: Enter', () => {
    it('pressing Enter in the input calls onValueChange and onCommit', () => {
      const { root, context } = renderEditor('2024-03-15');
      const input = getInput(root);

      // Change input value
      input.value = '2024-05-01';

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);

      expect(context.onValueChange).toHaveBeenCalledWith('2024-05-01');
      expect(context.onCommit).toHaveBeenCalled();
    });
  });

  // -- 6. Typing Escape calls onCancel --
  describe('Keyboard: Escape', () => {
    it('pressing Escape in the input calls onCancel', () => {
      const { root, context } = renderEditor('2024-03-15');
      const input = getInput(root);

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);

      expect(context.onCancel).toHaveBeenCalled();
    });

    it('pressing Escape on the root element calls onCancel', () => {
      const { root, context } = renderEditor('2024-03-15');

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      root.dispatchEvent(event);

      expect(context.onCancel).toHaveBeenCalled();
    });
  });

  // -- 7. Has Today and Clear buttons --
  describe('Footer buttons', () => {
    it('has a Today button', () => {
      const { root } = renderEditor('2024-03-15');
      const allButtons = Array.from(root.querySelectorAll('button'));
      const todayBtn = allButtons.find((b) => b.textContent === 'Today');
      expect(todayBtn).toBeDefined();
    });

    it('has a Clear button', () => {
      const { root } = renderEditor('2024-03-15');
      const allButtons = Array.from(root.querySelectorAll('button'));
      const clearBtn = allButtons.find((b) => b.textContent === 'Clear');
      expect(clearBtn).toBeDefined();
    });
  });

  // -- 8. Today button calls onValueChange with today's date --
  describe('Today button', () => {
    it('calls onValueChange with today\'s date and commits', async () => {
      const { root, context } = renderEditor('2024-03-15');

      clickButtonByText(root, 'Today');

      const today = new Date();
      const expectedDate = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

      expect(context.onValueChange).toHaveBeenCalledWith(expectedDate);

      // onCommit is called via setTimeout(0)
      await new Promise((r) => setTimeout(r, 10));

      expect(context.onCommit).toHaveBeenCalled();
    });

    it('updates the input text to today\'s date', () => {
      const { root } = renderEditor('2024-03-15');

      clickButtonByText(root, 'Today');

      const today = new Date();
      const expectedDate = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

      const input = getInput(root);
      expect(input.value).toBe(expectedDate);
    });

    it('updates the header to the current month', () => {
      const { root } = renderEditor('2024-03-15');

      clickButtonByText(root, 'Today');

      const today = new Date();
      const expectedHeader = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
      expect(getHeaderTitle(root)).toBe(expectedHeader);
    });
  });

  // -- 9. Clear button calls onValueChange with empty string --
  describe('Clear button', () => {
    it('calls onValueChange with empty string and commits', () => {
      const { root, context } = renderEditor('2024-03-15');

      clickButtonByText(root, 'Clear');

      expect(context.onValueChange).toHaveBeenCalledWith('');
      expect(context.onCommit).toHaveBeenCalled();
    });

    it('clears the input text', () => {
      const { root } = renderEditor('2024-03-15');

      clickButtonByText(root, 'Clear');

      const input = getInput(root);
      expect(input.value).toBe('');
    });
  });

  // -- 10. Previous/Next month buttons change the header text --
  describe('Month navigation', () => {
    it('previous month button changes header', () => {
      const { root } = renderEditor('2024-03-15');
      expect(getHeaderTitle(root)).toBe('March 2024');

      clickButton(root, 'Previous month');

      expect(getHeaderTitle(root)).toBe('February 2024');
    });

    it('next month button changes header', () => {
      const { root } = renderEditor('2024-03-15');
      expect(getHeaderTitle(root)).toBe('March 2024');

      clickButton(root, 'Next month');

      expect(getHeaderTitle(root)).toBe('April 2024');
    });

    it('navigating from January goes to December of previous year', () => {
      const { root } = renderEditor('2024-01-15');
      expect(getHeaderTitle(root)).toBe('January 2024');

      clickButton(root, 'Previous month');

      expect(getHeaderTitle(root)).toBe('December 2023');
    });

    it('navigating from December goes to January of next year', () => {
      const { root } = renderEditor('2024-12-15');
      expect(getHeaderTitle(root)).toBe('December 2024');

      clickButton(root, 'Next month');

      expect(getHeaderTitle(root)).toBe('January 2025');
    });

    it('can navigate multiple months in sequence', () => {
      const { root } = renderEditor('2024-06-15');
      expect(getHeaderTitle(root)).toBe('June 2024');

      clickButton(root, 'Next month');
      expect(getHeaderTitle(root)).toBe('July 2024');

      clickButton(root, 'Next month');
      expect(getHeaderTitle(root)).toBe('August 2024');

      clickButton(root, 'Previous month');
      expect(getHeaderTitle(root)).toBe('July 2024');
    });
  });

  // -- 11. Null value falls back to current month --
  describe('Null/undefined value fallback', () => {
    it('null value shows current month in header', () => {
      const { root } = renderEditor(null);

      const today = new Date();
      const expectedHeader = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
      expect(getHeaderTitle(root)).toBe(expectedHeader);
    });

    it('null value shows empty input', () => {
      const { root } = renderEditor(null);
      const input = getInput(root);
      expect(input.value).toBe('');
    });

    it('undefined value shows current month in header', () => {
      const { root } = renderEditor(undefined);

      const today = new Date();
      const expectedHeader = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
      expect(getHeaderTitle(root)).toBe(expectedHeader);
    });

    it('undefined value shows empty input', () => {
      const { root } = renderEditor(undefined);
      const input = getInput(root);
      expect(input.value).toBe('');
    });

    it('invalid date string falls back to current month', () => {
      const { root } = renderEditor('invalid-date');

      const today = new Date();
      const expectedHeader = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
      expect(getHeaderTitle(root)).toBe(expectedHeader);
    });

    it('valid date string shows that month', () => {
      const { root } = renderEditor('2023-09-25');
      expect(getHeaderTitle(root)).toBe('September 2023');
    });
  });

  // -- Additional: day headers --
  describe('Day headers', () => {
    it('shows day headers (Su, Mo, Tu, We, Th, Fr, Sa)', () => {
      const { root } = renderEditor('2024-03-15');
      const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      for (const dayName of dayNames) {
        const found = Array.from(root.querySelectorAll('div')).some(
          (el) => el.textContent === dayName
        );
        expect(found).toBe(true);
      }
    });
  });

  // -- Additional: 42 date cells --
  describe('Calendar grid', () => {
    it('renders 42 date cells (6 weeks x 7 days)', () => {
      const { root } = renderEditor('2024-03-15');
      const dateButtons = getAllDateButtons(root);
      expect(dateButtons).toHaveLength(42);
    });
  });

  // -- Additional: Focus --
  describe('Focus', () => {
    it('input is focused on mount (via setTimeout)', async () => {
      const { root } = renderEditor('2024-03-15');

      // Focus happens via setTimeout(0)
      await new Promise((r) => setTimeout(r, 10));

      const input = getInput(root);
      expect(document.activeElement).toBe(input);
    });
  });
});
