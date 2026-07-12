/**
 * ARIA semantics for the premium cell editors: screen readers must be able
 * to identify each editor's role and current value.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { RatingEditor } from '../Rating/RatingEditor';
import { SliderEditor } from '../Slider/SliderEditor';
import { TagsEditor } from '../Tags/TagsEditor';
import { ColorPickerEditor } from '../ColorPicker/ColorPickerEditor';
import type { ICellEditorProps } from '@alaarab/ogrid-core';

function createMockProps(
  overrides: Partial<ICellEditorProps<{ id: number }>> = {},
): ICellEditorProps<{ id: number }> {
  return {
    value: '',
    onValueChange: jest.fn(),
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    item: { id: 1 },
    column: { columnId: 'col', name: 'Col' },
    ...overrides,
  };
}

describe('editor ARIA semantics', () => {
  it('RatingEditor exposes a slider with value state', () => {
    render(<RatingEditor {...createMockProps({ value: 3 })} />);
    const slider = screen.getByRole('slider', { name: 'Rating' });
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '5');
    expect(slider).toHaveAttribute('aria-valuenow', '3');
    expect(slider).toHaveAttribute('aria-valuetext', '3 of 5 stars');
  });

  it('SliderEditor exposes a slider with value state', () => {
    render(
      <SliderEditor
        {...createMockProps({
          value: 40,
          cellEditorParams: { min: 0, max: 100, step: 1 },
        })}
      />,
    );
    const slider = screen.getByRole('slider', { name: 'Slider' });
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-valuenow', '40');
  });

  it('TagsEditor exposes a combobox that controls a listbox of options', () => {
    render(
      <TagsEditor
        {...createMockProps({
          value: '',
          cellEditorParams: { suggestions: ['Bug', 'Feature'], allowCreate: false },
        })}
      />,
    );
    const combobox = screen.getByRole('combobox');
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox', { name: 'Tag suggestions' });
    expect(combobox).toHaveAttribute('aria-controls', listbox.id);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('ColorPickerEditor swatches expose pressed state', () => {
    render(<ColorPickerEditor {...createMockProps({ value: '' })} />);
    const swatches = screen.getAllByRole('button', { pressed: false });
    expect(swatches.length).toBeGreaterThan(0);
  });
});
