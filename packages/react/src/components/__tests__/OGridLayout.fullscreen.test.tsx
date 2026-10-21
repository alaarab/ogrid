import { render, screen, fireEvent, act } from '@testing-library/react';
import { OGridLayout } from '../OGridLayout';

function renderFullScreen() {
  render(
    <OGridLayout fullScreen>
      <div>
        <input data-testid="grid-input" />
        <div tabIndex={0} data-testid="grid-cell" />
      </div>
    </OGridLayout>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
  expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeTruthy();
}

function pressEscape(target: Element, prevented: boolean) {
  const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  if (prevented) e.preventDefault();
  act(() => { target.dispatchEvent(e); });
}

describe('OGridLayout full screen Escape', () => {
  it('stays in full screen when Escape was already handled (grid, popover, editor)', () => {
    renderFullScreen();
    pressEscape(screen.getByTestId('grid-cell'), true);
    expect(screen.queryByRole('button', { name: 'Exit fullscreen' })).toBeTruthy();
  });

  it('stays in full screen when Escape comes from a text input', () => {
    renderFullScreen();
    pressEscape(screen.getByTestId('grid-input'), false);
    expect(screen.queryByRole('button', { name: 'Exit fullscreen' })).toBeTruthy();
  });

  it('exits full screen on an unhandled Escape', () => {
    renderFullScreen();
    pressEscape(screen.getByTestId('grid-cell'), false);
    expect(screen.queryByRole('button', { name: 'Fullscreen' })).toBeTruthy();
  });
});

function rootOf(button: HTMLElement): HTMLElement {
  // root > bordered container > toolbar strip > end section > button
  return button.parentElement!.parentElement!.parentElement!.parentElement as HTMLElement;
}

describe('OGridLayout full screen layer', () => {
  it('takes its z-index from --ogrid-z-fullscreen', () => {
    renderFullScreen();
    const root = rootOf(screen.getByRole('button', { name: 'Exit fullscreen' }));
    expect(root.style.position).toBe('fixed');
    expect(root.style.zIndex).toBe('var(--ogrid-z-fullscreen, 9999)');
  });

  it('keeps the toolbar and footer strips from shrinking under a max-height', () => {
    render(
      <OGridLayout fullScreen toolbar={<span>Tools</span>} toolbarBelow={<span>Chips</span>} pagination={<span>Pages</span>}>
        <div />
      </OGridLayout>
    );
    expect(screen.getByText('Tools').parentElement!.parentElement!.style.flexShrink).toBe('0');
    expect(screen.getByText('Chips').parentElement!.style.flexShrink).toBe('0');
    expect(screen.getByText('Pages').parentElement!.style.flexShrink).toBe('0');
  });
});

describe('OGridLayout full screen state', () => {
  it('reports changes through onFullScreenChange when uncontrolled', () => {
    const onFullScreenChange = jest.fn();
    render(<OGridLayout fullScreen onFullScreenChange={onFullScreenChange}><div tabIndex={0} data-testid="cell" /></OGridLayout>);
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    expect(onFullScreenChange).toHaveBeenLastCalledWith(true);
    pressEscape(screen.getByTestId('cell'), false);
    expect(onFullScreenChange).toHaveBeenLastCalledWith(false);
    expect(onFullScreenChange).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeTruthy();
  });

  it('follows the controlled isFullScreen prop and only asks to change it', () => {
    const onFullScreenChange = jest.fn();
    const { rerender } = render(
      <OGridLayout fullScreen isFullScreen={false} onFullScreenChange={onFullScreenChange}><div /></OGridLayout>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    expect(onFullScreenChange).toHaveBeenCalledWith(true);
    // The parent hasn't accepted the change yet.
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeTruthy();
    rerender(<OGridLayout fullScreen isFullScreen onFullScreenChange={onFullScreenChange}><div /></OGridLayout>);
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeTruthy();
  });

  it('enters full screen from the prop without the toolbar button', () => {
    const { container } = render(<OGridLayout isFullScreen><div /></OGridLayout>);
    expect((container.firstElementChild as HTMLElement).style.position).toBe('fixed');
    expect(screen.queryByRole('button', { name: /fullscreen/i })).toBeNull();
  });
});

describe('OGridLayout full screen page lock', () => {
  let scrollTo: jest.SpyInstance;
  beforeEach(() => {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = 'auto';
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 640 });
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 12 });
    scrollTo = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });
  afterEach(() => {
    scrollTo.mockRestore();
    document.body.style.overflow = '';
  });

  it('locks page scroll while full screen and restores it and the position on exit', () => {
    renderFullScreen();
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }));
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('auto');
    expect(scrollTo).toHaveBeenCalledWith(12, 640);
  });

  it('releases the lock when the grid unmounts in full screen', () => {
    const { unmount } = render(<OGridLayout isFullScreen><div /></OGridLayout>);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
    expect(scrollTo).toHaveBeenCalledWith(12, 640);
  });
});

describe('OGridLayout full screen icons', () => {
  /** Every x/y a shape draws through, read from points and line ends. */
  function iconCoordinates(button: HTMLElement): number[] {
    const svg = button.querySelector('svg') as SVGElement;
    const coords: number[] = [];
    for (const el of Array.from(svg.querySelectorAll('polyline, line'))) {
      const points = el.getAttribute('points');
      if (points) coords.push(...points.trim().split(/[\s,]+/).map(Number));
      for (const attr of ['x1', 'y1', 'x2', 'y2']) {
        const v = el.getAttribute(attr);
        if (v != null) coords.push(Number(v));
      }
    }
    return coords;
  }

  it('keeps both icons off the viewBox edge so strokes are not clipped', () => {
    renderFullScreen();
    const exit = iconCoordinates(screen.getByRole('button', { name: 'Exit fullscreen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }));
    const enter = iconCoordinates(screen.getByRole('button', { name: 'Fullscreen' }));
    for (const coords of [enter, exit]) {
      expect(coords.length).toBeGreaterThan(0);
      // A 1.5 stroke needs at least 0.75 of room on each side of a 16 box.
      for (const c of coords) {
        expect(c).toBeGreaterThanOrEqual(1);
        expect(c).toBeLessThanOrEqual(15);
      }
    }
  });
});
