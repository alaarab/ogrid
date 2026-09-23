import { render, screen, fireEvent } from '@testing-library/react';
import { SheetTabs } from '../SheetTabs';

const sheets = [
  { id: 's1', name: 'One' },
  { id: 's2', name: 'Two' },
  { id: 's3', name: 'Three' },
];

describe('SheetTabs keyboard', () => {
  it('uses a roving tabindex and arrow/Home/End to change sheets', () => {
    const onSheetChange = jest.fn();
    render(<SheetTabs sheets={sheets} activeSheet="s1" onSheetChange={onSheetChange} />);
    const [one, two, three] = screen.getAllByRole('tab');
    expect(one?.getAttribute('tabindex')).toBe('0');
    expect(two?.getAttribute('tabindex')).toBe('-1');

    fireEvent.keyDown(one as Element, { key: 'ArrowRight' });
    expect(onSheetChange).toHaveBeenLastCalledWith('s2');
    expect(document.activeElement).toBe(two);

    fireEvent.keyDown(one as Element, { key: 'ArrowLeft' });
    expect(onSheetChange).toHaveBeenLastCalledWith('s3');
    expect(document.activeElement).toBe(three);

    fireEvent.keyDown(three as Element, { key: 'Home' });
    expect(onSheetChange).toHaveBeenLastCalledWith('s1');
  });
});
