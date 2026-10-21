import * as React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BaseGridMenu } from '../BaseGridMenu';
import { resolveGridMenuItems } from '../../types/gridMenuTypes';
import type { IGridMenuItem } from '../../types/gridMenuTypes';
import { isPlainShortcut, matchesShortcut } from '../../utils/keyboardShortcut';

function Harness({ items, onClose = () => {} }: { items: IGridMenuItem[]; onClose?: () => void }) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <button type="button" ref={setAnchor}>Trigger</button>
      {open && anchor && (
        <BaseGridMenu items={items} anchorElement={anchor} ariaLabel="Options" onClose={() => { setOpen(false); onClose(); }} />
      )}
    </>
  );
}

const key = (el: Element, k: string) => fireEvent.keyDown(el, { key: k });

describe('BaseGridMenu', () => {
  it('runs an item and closes, and keeps a keepOpen item open', () => {
    const run = jest.fn();
    const toggle = jest.fn();
    render(<Harness items={[
      { id: 'a', label: 'Alpha', onClick: run },
      { id: 'b', label: 'Beta', checked: true, keepOpen: true, onClick: toggle },
    ]} />);
    const beta = screen.getByRole('menuitemcheckbox', { name: /Beta/ });
    expect(beta).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(beta);
    expect(toggle).toHaveBeenCalled();
    expect(screen.getByRole('menu', { name: 'Options' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Alpha' }));
    expect(run).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a submenu from the keyboard and goes back with ArrowLeft', () => {
    const csv = jest.fn();
    render(<Harness items={[
      { id: 'first', label: 'First' },
      { id: 'export', label: 'Export', items: [{ id: 'csv', label: 'CSV', onClick: csv }] },
    ]} />);
    const menu = screen.getByRole('menu', { name: 'Options' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'First' }));
    key(menu, 'ArrowDown');
    const exportItem = screen.getByRole('menuitem', { name: 'Export' });
    expect(document.activeElement).toBe(exportItem);
    expect(exportItem).toHaveAttribute('aria-haspopup', 'menu');
    key(exportItem, 'ArrowRight');
    expect(exportItem).toHaveAttribute('aria-expanded', 'true');
    const csvItem = screen.getByRole('menuitem', { name: 'CSV' });
    expect(document.activeElement).toBe(csvItem);
    key(csvItem, 'ArrowLeft');
    expect(screen.queryByRole('menuitem', { name: 'CSV' })).toBeNull();
    expect(document.activeElement).toBe(exportItem);
    key(exportItem, 'ArrowRight');
    fireEvent.click(screen.getByRole('menuitem', { name: 'CSV' }));
    expect(csv).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Escape in a submenu closes only the submenu; Escape at the top closes the menu', () => {
    const onClose = jest.fn();
    render(<Harness onClose={onClose} items={[{ id: 'more', label: 'More', items: [{ id: 'x', label: 'X' }] }]} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'More' }));
    key(screen.getByRole('menuitem', { name: 'X' }), 'Escape');
    expect(screen.queryByRole('menuitem', { name: 'X' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    key(screen.getByRole('menuitem', { name: 'More' }), 'Escape');
    expect(onClose).toHaveBeenCalled();
  });

  it('opens a submenu on hover after a short delay', () => {
    jest.useFakeTimers();
    try {
      render(<Harness items={[{ id: 'more', label: 'More', items: [{ id: 'x', label: 'X' }] }]} />);
      fireEvent.mouseEnter(screen.getByRole('menuitem', { name: 'More' }));
      expect(screen.queryByRole('menuitem', { name: 'X' })).toBeNull();
      act(() => { jest.advanceTimersByTime(200); });
      expect(screen.getByRole('menuitem', { name: 'X' })).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('filters a searchable submenu by label', () => {
    render(<Harness items={[{
      id: 'cols', label: 'Columns', searchable: true,
      items: [{ id: 'a', label: 'Owner' }, { id: 'b', label: 'Budget' }, { id: 'c', label: 'Start date' }],
    }]} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Columns' }));
    const search = screen.getByRole('searchbox', { name: 'Search columns' });
    expect(document.activeElement).toBe(search);
    fireEvent.change(search, { target: { value: 'bud' } });
    expect(screen.getByRole('menuitem', { name: 'Budget' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Owner' })).toBeNull();
    key(search, 'ArrowDown');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Budget' }));
  });

  it('closes on a press outside the menu', () => {
    const onClose = jest.fn();
    render(<Harness onClose={onClose} items={[{ id: 'a', label: 'A' }]} />);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('resolveGridMenuItems', () => {
  const builtIns: IGridMenuItem[] = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];

  it('appends an array after a divider', () => {
    const out = resolveGridMenuItems(builtIns, [{ id: 'c', label: 'C' }], {});
    expect(out.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(out[1]?.divider).toBe(true);
  });

  it('lets a function hide, reorder and add', () => {
    const out = resolveGridMenuItems(builtIns, (items, ctx: { n: number }) => [
      { id: 'new', label: `N${ctx.n}` },
      ...items.filter((i) => i.id !== 'a'),
    ], { n: 1 });
    expect(out.map((i) => i.label)).toEqual(['N1', 'B']);
  });

  it('returns the built-ins when nothing is passed', () => {
    expect(resolveGridMenuItems(builtIns, undefined, {})).toBe(builtIns);
  });
});

describe('keyboard shortcuts', () => {
  const ev = (k: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>> = {}) =>
    ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });

  it('matches a plain key only without modifiers', () => {
    expect(matchesShortcut(ev('f'), 'f')).toBe(true);
    expect(matchesShortcut(ev('F', { shiftKey: true }), 'f')).toBe(false);
    expect(matchesShortcut(ev('f', { ctrlKey: true }), 'f')).toBe(false);
    expect(isPlainShortcut('f')).toBe(true);
  });

  it('matches modifier shortcuts, with Mod as Ctrl or Cmd', () => {
    expect(matchesShortcut(ev('F', { shiftKey: true }), 'Shift+F')).toBe(true);
    expect(matchesShortcut(ev('f', { metaKey: true, shiftKey: true }), 'Mod+Shift+F')).toBe(true);
    expect(matchesShortcut(ev('f', { ctrlKey: true, shiftKey: true }), 'Mod+Shift+F')).toBe(true);
    expect(matchesShortcut(ev('f', { shiftKey: true }), 'Mod+Shift+F')).toBe(false);
    expect(isPlainShortcut('Shift+F')).toBe(false);
  });
});
