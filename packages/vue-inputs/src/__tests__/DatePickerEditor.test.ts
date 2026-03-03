import { mount } from '@vue/test-utils';
import { DatePickerEditor } from '../DatePicker/DatePickerEditor';
import { MONTH_NAMES, DAY_NAMES, formatDate } from '@alaarab/ogrid-inputs';
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

function mountEditor(overrides: Partial<ICellEditorProps<{ id: number }>> = {}) {
  const props = createMockProps(overrides);
  const wrapper = mount(DatePickerEditor, {
    props: props as Record<string, unknown>,
  });
  return { wrapper, props };
}

// ---------- Tests ----------

describe('DatePickerEditor', () => {
  // ── 1. Rendering ──

  describe('Rendering', () => {
    it('renders calendar grid with correct month/year', () => {
      const { wrapper } = mountEditor({ value: '2024-03-15' });
      expect(wrapper.text()).toContain('March 2024');
    });

    it('shows text input with initial value', () => {
      const { wrapper } = mountEditor({ value: '2024-03-15' });
      const input = wrapper.find('input[placeholder="YYYY-MM-DD"]');
      expect(input.exists()).toBe(true);
      expect((input.element as HTMLInputElement).value).toBe('2024-03-15');
    });

    it('shows "Today" and "Clear" buttons', () => {
      const { wrapper } = mountEditor();
      const buttons = wrapper.findAll('button');
      const buttonTexts = buttons.map((b) => b.text());
      expect(buttonTexts).toContain('Today');
      expect(buttonTexts).toContain('Clear');
    });

    it('shows day headers (Su, Mo, Tu, We, Th, Fr, Sa)', () => {
      const { wrapper } = mountEditor();
      for (const dayName of DAY_NAMES) {
        expect(wrapper.text()).toContain(dayName);
      }
    });

    it('renders previous and next month navigation buttons', () => {
      const { wrapper } = mountEditor();
      expect(wrapper.find('button[aria-label="Previous month"]').exists()).toBe(true);
      expect(wrapper.find('button[aria-label="Next month"]').exists()).toBe(true);
    });

    it('renders 42 date cells (6 weeks x 7 days)', () => {
      const { wrapper } = mountEditor({ value: '2024-03-15' });
      const allButtons = wrapper.findAll('button');
      // Filter out named buttons (Today, Clear, Previous month, Next month)
      const dateCells = allButtons.filter(
        (btn) =>
          btn.attributes('aria-label') !== 'Previous month' &&
          btn.attributes('aria-label') !== 'Next month' &&
          btn.text() !== 'Today' &&
          btn.text() !== 'Clear'
      );
      expect(dateCells).toHaveLength(42);
    });
  });

  // ── 2. Date Selection ──

  describe('Date Selection', () => {
    it('clicking a date cell calls onValueChange then onCommit', async () => {
      const { wrapper, props } = mountEditor({ value: '2024-03-15' });

      const allButtons = wrapper.findAll('button');
      const dateCells = allButtons.filter(
        (btn) =>
          btn.attributes('aria-label') !== 'Previous month' &&
          btn.attributes('aria-label') !== 'Next month' &&
          btn.text() !== 'Today' &&
          btn.text() !== 'Clear'
      );
      // Find the button for day 10
      const day10 = dateCells.find((btn) => btn.text() === '10');
      expect(day10).toBeDefined();

      await day10!.trigger('click');

      expect(props.onValueChange).toHaveBeenCalledWith('2024-03-10');

      // onCommit is called via setTimeout(0)
      await new Promise((r) => setTimeout(r, 10));

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('selected date shows the correct value in the input after click', async () => {
      const { wrapper } = mountEditor({ value: '2024-03-15' });

      const allButtons = wrapper.findAll('button');
      const dateCells = allButtons.filter(
        (btn) =>
          btn.attributes('aria-label') !== 'Previous month' &&
          btn.attributes('aria-label') !== 'Next month' &&
          btn.text() !== 'Today' &&
          btn.text() !== 'Clear'
      );
      const day20Candidates = dateCells.filter((btn) => btn.text() === '20');
      const day20 = day20Candidates[0];

      await day20!.trigger('click');

      const input = wrapper.find('input[placeholder="YYYY-MM-DD"]');
      expect((input.element as HTMLInputElement).value).toBe('2024-03-20');
    });
  });

  // ── 3. Text Input ──

  describe('Text Input', () => {
    it('typing a valid date updates the calendar view', async () => {
      const { wrapper } = mountEditor({ value: '2024-03-15' });

      const input = wrapper.find('input[placeholder="YYYY-MM-DD"]');
      // Simulate clearing and typing a new date
      await input.setValue('2024-06-20');
      // The onInput event handler parses the date
      await input.trigger('input');

      expect(wrapper.text()).toContain('June 2024');
    });

    it('pressing Enter commits the value', async () => {
      const { wrapper, props } = mountEditor({ value: '2024-03-15' });

      const input = wrapper.find('input[placeholder="YYYY-MM-DD"]');
      await input.setValue('2024-05-01');
      await input.trigger('input');
      await input.trigger('keydown', { key: 'Enter' });

      expect(props.onValueChange).toHaveBeenCalledWith('2024-05-01');
      expect(props.onCommit).toHaveBeenCalled();
    });

    it('pressing Escape cancels', async () => {
      const { wrapper, props } = mountEditor({ value: '2024-03-15' });

      const input = wrapper.find('input[placeholder="YYYY-MM-DD"]');
      await input.trigger('keydown', { key: 'Escape' });

      expect(props.onCancel).toHaveBeenCalled();
    });

    it('typing an invalid date does not update the calendar view', async () => {
      const { wrapper } = mountEditor({ value: '2024-03-15' });

      const input = wrapper.find('input[placeholder="YYYY-MM-DD"]');
      await input.setValue('not-a-date');
      await input.trigger('input');

      // Calendar should still show March 2024 (the initial view)
      expect(wrapper.text()).toContain('March 2024');
    });
  });

  // ── 4. Navigation ──

  describe('Navigation', () => {
    it('previous month button navigates back', async () => {
      const { wrapper } = mountEditor({ value: '2024-03-15' });

      expect(wrapper.text()).toContain('March 2024');

      await wrapper.find('button[aria-label="Previous month"]').trigger('click');

      expect(wrapper.text()).toContain('February 2024');
    });

    it('next month button navigates forward', async () => {
      const { wrapper } = mountEditor({ value: '2024-03-15' });

      expect(wrapper.text()).toContain('March 2024');

      await wrapper.find('button[aria-label="Next month"]').trigger('click');

      expect(wrapper.text()).toContain('April 2024');
    });

    it('navigating from January goes to December of previous year', async () => {
      const { wrapper } = mountEditor({ value: '2024-01-15' });

      expect(wrapper.text()).toContain('January 2024');

      await wrapper.find('button[aria-label="Previous month"]').trigger('click');

      expect(wrapper.text()).toContain('December 2023');
    });

    it('navigating from December goes to January of next year', async () => {
      const { wrapper } = mountEditor({ value: '2024-12-15' });

      expect(wrapper.text()).toContain('December 2024');

      await wrapper.find('button[aria-label="Next month"]').trigger('click');

      expect(wrapper.text()).toContain('January 2025');
    });

    it('can navigate multiple months in sequence', async () => {
      const { wrapper } = mountEditor({ value: '2024-06-15' });

      expect(wrapper.text()).toContain('June 2024');

      await wrapper.find('button[aria-label="Next month"]').trigger('click');
      expect(wrapper.text()).toContain('July 2024');

      await wrapper.find('button[aria-label="Next month"]').trigger('click');
      expect(wrapper.text()).toContain('August 2024');

      await wrapper.find('button[aria-label="Previous month"]').trigger('click');
      expect(wrapper.text()).toContain('July 2024');
    });
  });

  // ── 5. Today Button ──

  describe('Today Button', () => {
    it('clicking "Today" selects today\'s date and commits', async () => {
      const { wrapper, props } = mountEditor({ value: '2024-03-15' });

      const todayBtn = wrapper.findAll('button').find((b) => b.text() === 'Today');
      await todayBtn!.trigger('click');

      const today = new Date();
      const expectedDate = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

      expect(props.onValueChange).toHaveBeenCalledWith(expectedDate);

      // onCommit called via setTimeout(0)
      await new Promise((r) => setTimeout(r, 10));

      expect(props.onCommit).toHaveBeenCalled();
    });

    it('clicking "Today" updates the input text', async () => {
      const { wrapper } = mountEditor({ value: '2024-03-15' });

      const todayBtn = wrapper.findAll('button').find((b) => b.text() === 'Today');
      await todayBtn!.trigger('click');

      const today = new Date();
      const expectedDate = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

      const input = wrapper.find('input[placeholder="YYYY-MM-DD"]');
      expect((input.element as HTMLInputElement).value).toBe(expectedDate);
    });
  });

  // ── 6. Clear Button ──

  describe('Clear Button', () => {
    it('clicking "Clear" commits empty string', async () => {
      const { wrapper, props } = mountEditor({ value: '2024-03-15' });

      const clearBtn = wrapper.findAll('button').find((b) => b.text() === 'Clear');
      await clearBtn!.trigger('click');

      expect(props.onValueChange).toHaveBeenCalledWith('');
      expect(props.onCommit).toHaveBeenCalled();
    });

    it('clicking "Clear" clears the input text', async () => {
      const { wrapper } = mountEditor({ value: '2024-03-15' });

      const clearBtn = wrapper.findAll('button').find((b) => b.text() === 'Clear');
      await clearBtn!.trigger('click');

      const input = wrapper.find('input[placeholder="YYYY-MM-DD"]');
      expect((input.element as HTMLInputElement).value).toBe('');
    });
  });

  // ── 7. Initial Value ──

  describe('Initial Value', () => {
    it('null value shows current month', () => {
      const { wrapper } = mountEditor({ value: null });

      const today = new Date();
      const expectedHeader = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
      expect(wrapper.text()).toContain(expectedHeader);
    });

    it('undefined value shows current month', () => {
      const { wrapper } = mountEditor({ value: undefined });

      const today = new Date();
      const expectedHeader = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
      expect(wrapper.text()).toContain(expectedHeader);
    });

    it('valid date string shows that month', () => {
      const { wrapper } = mountEditor({ value: '2023-09-25' });

      expect(wrapper.text()).toContain('September 2023');
    });

    it('invalid value falls back to current month', () => {
      const { wrapper } = mountEditor({ value: 'invalid-date' });

      const today = new Date();
      const expectedHeader = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
      expect(wrapper.text()).toContain(expectedHeader);
    });

    it('null value shows empty input', () => {
      const { wrapper } = mountEditor({ value: null });

      const input = wrapper.find('input[placeholder="YYYY-MM-DD"]');
      expect((input.element as HTMLInputElement).value).toBe('');
    });

    it('valid date shows formatted date in input', () => {
      const { wrapper } = mountEditor({ value: '2024-01-05' });

      const input = wrapper.find('input[placeholder="YYYY-MM-DD"]');
      expect((input.element as HTMLInputElement).value).toBe('2024-01-05');
    });

    it('numeric value is coerced to string and parsed', () => {
      // The component does String(value), so a number like 20240315 would be "20240315"
      // which is not valid YYYY-MM-DD, so it should fall back to current month
      const { wrapper } = mountEditor({ value: 20240315 as unknown });

      const today = new Date();
      const expectedHeader = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
      expect(wrapper.text()).toContain(expectedHeader);
    });
  });

  // ── 8. Focus ──

  describe('Focus', () => {
    it('input is focused on mount', () => {
      // Must attach to document for focus() to work in jsdom
      const props = createMockProps({ value: '2024-03-15' });
      const wrapper = mount(DatePickerEditor, {
        props: props as Record<string, unknown>,
        attachTo: document.body,
      });

      const input = wrapper.find('input[placeholder="YYYY-MM-DD"]');
      expect(input.element).toBe(document.activeElement);

      wrapper.unmount();
    });
  });
});
