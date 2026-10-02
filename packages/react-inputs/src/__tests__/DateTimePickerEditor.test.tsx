import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTimePickerEditor } from '../DateTimePicker/DateTimePickerEditor';
import type { ICellEditorProps } from '@alaarab/ogrid-core';

function createMockProps(
  overrides: Partial<ICellEditorProps<{ id: number }>> = {},
): ICellEditorProps<{ id: number }> {
  return {
    value: '2024-01-15 2:30 PM',
    onValueChange: jest.fn(),
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    item: { id: 1 },
    column: { columnId: 'at', name: 'At' },
    ...overrides,
  };
}

function renderEditor(overrides: Partial<ICellEditorProps<{ id: number }>> = {}) {
  const props = createMockProps(overrides);
  const result = render(<DateTimePickerEditor {...props} />);
  return { ...result, props };
}

function getInput(): HTMLInputElement {
  return screen.getByLabelText('Date and time') as HTMLInputElement;
}

describe('DateTimePickerEditor', () => {
  describe('I02 - stored values other than the two legacy shapes', () => {
    it('parses an ISO string with seconds instead of showing today', () => {
      renderEditor({ value: '2024-01-15T10:30:00' });
      expect(screen.getByText('January 2024')).toBeInTheDocument();
      expect(getInput().value).toBe('2024-01-15 10:30');
    });

    it('parses a Date object', () => {
      renderEditor({ value: new Date(2024, 0, 15, 10, 30) });
      expect(screen.getByText('January 2024')).toBeInTheDocument();
    });

    it('does not fabricate today when the stored value is unparseable', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: 'not-a-date' });

      // No date is selected, so choosing a time must not emit today + that time.
      await user.click(screen.getByRole('button', { name: '05' }));

      expect(props.onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('I03 - keyboard operable', () => {
    it('focuses the text input on mount', () => {
      renderEditor();
      expect(document.activeElement).toBe(getInput());
    });

    it('commits a valid typed value with Enter', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '2024-01-15 2:30 PM' });

      const input = getInput();
      await user.clear(input);
      await user.type(input, '2024-03-01 9:15 AM');
      await user.keyboard('{Enter}');

      expect(props.onValueChange).toHaveBeenLastCalledWith('2024-03-01 9:15 AM');
      expect(props.onCommit).toHaveBeenCalled();
    });

    it('Apply commits a valid typed value without Enter', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '2024-01-15 2:30 PM' });

      fireEvent.change(getInput(), { target: { value: '2024-03-01 9:15 AM' } });
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      expect(props.onValueChange).toHaveBeenLastCalledWith('2024-03-01 9:15 AM');
      expect(props.onCommit).toHaveBeenCalled();
    });

    it('refuses an unparseable typed value with Enter', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '2024-01-15 2:30 PM' });

      const input = getInput();
      await user.clear(input);
      await user.type(input, 'garbage');
      await user.keyboard('{Enter}');

      expect(props.onCommit).not.toHaveBeenCalled();
    });
  });

  describe('I10 - stored 24-hour format is preserved', () => {
    it('shows and re-commits a 24-hour value as 24-hour', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '2024-01-15 14:30' });

      expect(getInput().value).toBe('2024-01-15 14:30');

      await user.click(getInput());
      await user.keyboard('{Enter}');

      expect(props.onValueChange).toHaveBeenLastCalledWith('2024-01-15 14:30');
    });
  });
});
