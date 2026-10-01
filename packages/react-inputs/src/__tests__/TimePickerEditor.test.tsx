import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimePickerEditor } from '../TimePicker/TimePickerEditor';
import type { ICellEditorProps } from '@alaarab/ogrid-core';

type TimePickerParams = NonNullable<ICellEditorProps<{ id: number }>['cellEditorParams']> & {
  minuteStep?: number;
};

type TimePickerTestProps = Omit<ICellEditorProps<{ id: number }>, 'cellEditorParams'> & {
  cellEditorParams?: TimePickerParams;
};

function createMockProps(overrides: Partial<TimePickerTestProps> = {}): TimePickerTestProps {
  return {
    value: '2:30 PM',
    onValueChange: jest.fn(),
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    item: { id: 1 },
    column: { columnId: 'time', name: 'Time' },
    ...overrides,
  };
}

function renderEditor(overrides: Partial<TimePickerTestProps> = {}) {
  const props = createMockProps(overrides);
  const result = render(<TimePickerEditor {...props} />);
  return { ...result, props };
}

function getInput(): HTMLInputElement {
  return screen.getByLabelText('Time') as HTMLInputElement;
}

describe('TimePickerEditor', () => {
  describe('I08 - hour/minute/AM-PM selections are committable', () => {
    it('commits the picked hour and minute via the Apply button', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '2:30 PM' });

      await user.click(screen.getByRole('button', { name: '3' }));
      await user.click(screen.getByRole('button', { name: '05' }));
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      expect(props.onValueChange).toHaveBeenLastCalledWith('3:05 PM');
      expect(props.onCommit).toHaveBeenCalled();
    });

    it('renders an Apply button', () => {
      renderEditor();
      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    });
  });

  describe('I01 - invalid minuteStep does not hang', () => {
    it('renders minute options when minuteStep is 0', () => {
      renderEditor({ value: '2:30 PM', cellEditorParams: { minuteStep: 0 } });
      expect(screen.getByRole('button', { name: '00' })).toBeInTheDocument();
    });
  });

  describe('I07 - Enter validates input', () => {
    it('refuses to commit unparseable text', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '2:30 PM' });

      const input = getInput();
      await user.clear(input);
      await user.type(input, '25:99');
      await user.keyboard('{Enter}');

      expect(props.onCommit).not.toHaveBeenCalled();
    });

    it('commits the canonical value for valid text', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '2:30 PM' });

      const input = getInput();
      await user.clear(input);
      await user.type(input, '9:15 AM');
      await user.keyboard('{Enter}');

      expect(props.onValueChange).toHaveBeenLastCalledWith('9:15 AM');
      expect(props.onCommit).toHaveBeenCalled();
    });
  });

  describe('I10 - stored 24-hour format is preserved', () => {
    it('shows and re-commits "14:30" as 24-hour, not "2:30 PM"', async () => {
      const user = userEvent.setup();
      const { props } = renderEditor({ value: '14:30' });

      expect(getInput().value).toBe('14:30');

      await user.click(getInput());
      await user.keyboard('{Enter}');

      expect(props.onValueChange).toHaveBeenLastCalledWith('14:30');
    });
  });
});
