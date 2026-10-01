import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseColumnHeaderMenu } from '../BaseColumnHeaderMenu';
import { GridContextMenu } from '../GridContextMenu';
import { SideBar } from '../SideBar';
import { SheetTabs } from '../SheetTabs';

function HeaderMenuHarness({ onGridKey, onSortAsc = () => {}, onClose = () => {} }: { onGridKey?: () => void; onSortAsc?: () => void; onClose?: () => void }) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  return (
    <div onKeyDown={onGridKey}>
      <button type="button" ref={setAnchor}>
        Name column options
      </button>
      <BaseColumnHeaderMenu
        isOpen={anchor != null}
        anchorElement={anchor}
        columnName="Name"
        onClose={onClose}
        onPinLeft={() => {}}
        onPinRight={() => {}}
        onUnpin={() => {}}
        onSortAsc={onSortAsc}
        onSortDesc={() => {}}
        onClearSort={() => {}}
        onAutosizeThis={() => {}}
        onAutosizeAll={() => {}}
        canPinLeft
        canPinRight
        canUnpin={false}
        currentSort={null}
        isSortable
        isResizable
      />
    </div>
  );
}

describe('column header menu (R12)', () => {
  it('has menu semantics, focuses the first item, and navigates with arrows', () => {
    render(<HeaderMenuHarness />);
    const menu = screen.getByRole('menu', { name: 'Name column options' });
    const items = screen.getAllByRole('menuitem');
    expect(menu).toBeTruthy();
    expect(items.length).toBeGreaterThan(2);
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0] as Element, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1] as Element, { key: 'ArrowUp' });
    fireEvent.keyDown(items[0] as Element, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('does not let menu keys reach the grid handler', () => {
    const onGridKey = jest.fn();
    render(<HeaderMenuHarness onGridKey={onGridKey} />);
    const items = screen.getAllByRole('menuitem');
    for (const key of ['ArrowDown', 'Enter', ' ', 'Tab', 'Home', 'End', 'Escape']) {
      fireEvent.keyDown(items[0] as Element, { key });
    }
    expect(onGridKey).not.toHaveBeenCalled();
  });

  it('Escape closes and Enter/click activates an item', () => {
    const onClose = jest.fn();
    const onSortAsc = jest.fn();
    render(<HeaderMenuHarness onClose={onClose} onSortAsc={onSortAsc} />);
    const sortAsc = screen.getByRole('menuitem', { name: /ascending/i });
    fireEvent.click(sortAsc);
    expect(onSortAsc).toHaveBeenCalled();
    fireEvent.keyDown(sortAsc, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('returns focus to the trigger when the menu closes', () => {
    function ClosableHarness() {
      const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
      const [open, setOpen] = React.useState(true);
      const noop = () => {};
      return (
        <>
          <button type="button" ref={setAnchor}>
            Name column options
          </button>
          <BaseColumnHeaderMenu
            isOpen={open && anchor != null}
            anchorElement={anchor}
            onClose={() => setOpen(false)}
            onPinLeft={noop}
            onPinRight={noop}
            onUnpin={noop}
            onSortAsc={noop}
            onSortDesc={noop}
            onClearSort={noop}
            onAutosizeThis={noop}
            onAutosizeAll={noop}
            canPinLeft
            canPinRight
            canUnpin={false}
            currentSort={null}
            isSortable
            isResizable
          />
        </>
      );
    }
    render(<ClosableHarness />);
    const trigger = screen.getByRole('button', { name: 'Name column options' });
    const [first] = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first as Element, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('grid context menu (R11)', () => {
  function renderMenu(onGridKey = jest.fn(), onClose = jest.fn()) {
    render(
      <div onKeyDown={onGridKey}>
        <GridContextMenu
          x={10}
          y={10}
          hasSelection
          canUndo
          canRedo
          onClose={onClose}
          onCopy={() => {}}
          onCut={() => {}}
          onPaste={() => {}}
          onSelectAll={() => {}}
          onUndo={() => {}}
          onRedo={() => {}}
        />
      </div>
    );
    return { onGridKey, onClose };
  }

  it('gives items menuitem roles and focuses the first enabled item on open', () => {
    renderMenu();
    const items = screen.getAllByRole('menuitem');
    expect(items.length).toBeGreaterThan(3);
    expect(document.activeElement).toBe(items[0]);
  });

  it('supports arrow/Home/End navigation without leaking keys to the grid', () => {
    const { onGridKey } = renderMenu();
    const items = screen.getAllByRole('menuitem');
    fireEvent.keyDown(items[0] as Element, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' });
    expect(onGridKey).not.toHaveBeenCalled();
  });

  it('restores focus to the previously focused element when it closes', () => {
    const outer = document.createElement('button');
    document.body.appendChild(outer);
    outer.focus();
    const { unmount } = render(
      <GridContextMenu x={0} y={0} hasSelection canUndo canRedo onClose={() => {}} onCopy={() => {}} onCut={() => {}} onPaste={() => {}} onSelectAll={() => {}} onUndo={() => {}} onRedo={() => {}} />
    );
    expect(document.activeElement).not.toBe(outer);
    unmount();
    expect(document.activeElement).toBe(outer);
    outer.remove();
  });
});

describe('SideBar tabs (A07)', () => {
  it('links tabs to the panel and uses roving tabindex with arrow keys', () => {
    const noop = jest.fn();
    render(
      <SideBar
        activePanel="columns"
        onPanelChange={noop}
        panels={['columns', 'filters']}
        position="right"
        columns={[]}
        visibleColumns={new Set()}
        onVisibilityChange={noop}
        filterableColumns={[]}
        filters={{}}
        onFilterChange={noop}
        filterOptions={{}}
      />
    );
    const [columnsTab, filtersTab] = screen.getAllByRole('tab');
    const panel = screen.getByRole('tabpanel');
    expect(columnsTab?.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(columnsTab?.id);
    expect(columnsTab?.getAttribute('tabindex')).toBe('0');
    expect(filtersTab?.getAttribute('tabindex')).toBe('-1');
    fireEvent.keyDown(columnsTab as Element, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(filtersTab);
  });
});

describe('SheetTabs (A07)', () => {
  it('keeps the Add sheet button outside the tablist', () => {
    render(<SheetTabs sheets={[{ id: 'a', name: 'A' }]} activeSheet="a" onSheetChange={() => {}} onSheetAdd={() => {}} />);
    const tablist = screen.getByRole('tablist');
    expect(tablist.contains(screen.getByRole('button', { name: 'Add sheet' }))).toBe(false);
  });
});
