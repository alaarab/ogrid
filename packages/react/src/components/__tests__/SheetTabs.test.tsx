import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SheetTabs, moveSheetId } from '../SheetTabs';

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

describe('moveSheetId', () => {
  it('moves an id before or after another', () => {
    expect(moveSheetId(['a', 'b', 'c'], 'a', 'c', 'after')).toEqual(['b', 'c', 'a']);
    expect(moveSheetId(['a', 'b', 'c'], 'c', 'a', 'before')).toEqual(['c', 'a', 'b']);
    expect(moveSheetId(['a', 'b', 'c'], 'b', 'b', 'after')).toEqual(['a', 'b', 'c']);
    expect(moveSheetId(['a', 'b'], 'x', 'a', 'after')).toEqual(['a', 'b']);
  });
});

describe('SheetTabs editing', () => {
  it('double-click renames a tab inline; Enter commits, Escape cancels', () => {
    const onSheetRename = jest.fn();
    render(<SheetTabs sheets={sheets} activeSheet="s1" onSheetChange={() => {}} onSheetRename={onSheetRename} />);
    fireEvent.doubleClick(screen.getByRole('tab', { name: 'Two' }));
    const input = screen.getByRole('textbox', { name: 'Sheet name' }) as HTMLInputElement;
    expect(input.value).toBe('Two');
    fireEvent.change(input, { target: { value: 'Budget' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSheetRename).toHaveBeenCalledWith('s2', 'Budget');
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'One' }), { key: 'F2' });
    const again = screen.getByRole('textbox', { name: 'Sheet name' });
    fireEvent.change(again, { target: { value: 'Nope' } });
    fireEvent.keyDown(again, { key: 'Escape' });
    expect(onSheetRename).toHaveBeenCalledTimes(1);
  });

  it('does not rename without onSheetRename', () => {
    render(<SheetTabs sheets={sheets} activeSheet="s1" onSheetChange={() => {}} />);
    fireEvent.doubleClick(screen.getByRole('tab', { name: 'Two' }));
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('dragging a tab onto another reorders the sheets', () => {
    const onSheetReorder = jest.fn();
    render(<SheetTabs sheets={sheets} activeSheet="s1" onSheetChange={() => {}} onSheetReorder={onSheetReorder} />);
    const one = screen.getByRole('tab', { name: 'One' });
    const three = screen.getByRole('tab', { name: 'Three' });
    expect(one.getAttribute('draggable')).toBe('true');
    const dataTransfer = { setData: () => {}, effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(one, { dataTransfer });
    fireEvent.dragOver(three, { dataTransfer });
    fireEvent.drop(three, { dataTransfer });
    // Dropped on the left half of "Three".
    expect(onSheetReorder).toHaveBeenCalledWith(['s2', 's1', 's3']);
  });

  it('the tab menu (Shift+F10) moves, colors and deletes a sheet', () => {
    const onSheetReorder = jest.fn();
    const onSheetDelete = jest.fn();
    const onSheetColorChange = jest.fn();
    render(
      <SheetTabs
        sheets={sheets}
        activeSheet="s2"
        onSheetChange={() => {}}
        onSheetReorder={onSheetReorder}
        onSheetDelete={onSheetDelete}
        onSheetColorChange={onSheetColorChange}
      />,
    );
    const two = screen.getByRole('tab', { name: 'Two' });
    const openMenu = () => {
      fireEvent.keyDown(two, { key: 'F10', shiftKey: true });
      return screen.getByRole('menu', { name: 'Two sheet options' });
    };
    const menu = openMenu();
    // Focus goes to the first item; arrows move through the menu.
    expect(document.activeElement?.textContent).toBe('Move left');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toBe('Move right');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move right' }));
    expect(onSheetReorder).toHaveBeenCalledWith(['s1', 's3', 's2']);
    expect(screen.queryByRole('menu')).toBeNull();

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Green tab color' }));
    expect(onSheetColorChange).toHaveBeenCalledWith('s2', '#70ad47');

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onSheetDelete).toHaveBeenCalledWith('s2');
  });

  it('right-click opens the tab menu; Rename edits inline; Delete is disabled for the last sheet', async () => {
    const onSheetRename = jest.fn();
    render(
      <SheetTabs
        sheets={[{ id: 'only', name: 'Only', color: '#c00000' }]}
        activeSheet="only"
        onSheetChange={() => {}}
        onSheetRename={onSheetRename}
        onSheetDelete={() => {}}
        onSheetColorChange={() => {}}
      />,
    );
    fireEvent.contextMenu(screen.getByRole('tab', { name: 'Only' }), { clientX: 20, clientY: 300 });
    expect((screen.getByRole('menuitem', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('menuitem', { name: 'Red tab color (current)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = await screen.findByRole('textbox', { name: 'Sheet name' });
    await waitFor(() => expect(document.activeElement).toBe(input));
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.blur(input);
    expect(onSheetRename).toHaveBeenCalledWith('only', 'Renamed');
  });

  it('shows no tab menu without editing callbacks', () => {
    render(<SheetTabs sheets={sheets} activeSheet="s1" onSheetChange={() => {}} />);
    fireEvent.contextMenu(screen.getByRole('tab', { name: 'One' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
