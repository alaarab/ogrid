import * as React from 'react';
import { render, screen, act } from '@testing-library/react';
import { useMiddleClickScroll } from '../useMiddleClickScroll';

function Harness(): React.ReactElement {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  useMiddleClickScroll({ wrapperRef });
  return (
    <div ref={wrapperRef} data-testid="wrapper">
      <a href="/somewhere" data-testid="link">
        A link
      </a>
    </div>
  );
}

// Grid cells cancel pointerdown, so the browser never sends mousedown: the hook must start from pointerdown.
function middleMouseDown(target: Element, x = 10, y = 10): MouseEvent {
  const event = new MouseEvent('pointerdown', {
    button: 1,
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  target.dispatchEvent(event);
  return event;
}

function indicator(): Element | null {
  return document.querySelector('[data-ogrid-scroll-indicator]');
}

describe('useMiddleClickScroll', () => {
  it('does not start a pan or swallow middle-click on an interactive target', () => {
    render(<Harness />);
    const event = middleMouseDown(screen.getByTestId('link'));
    expect(event.defaultPrevented).toBe(false);
    expect(indicator()).toBeNull();
  });

  it('starts a pan on a non-interactive target', async () => {
    render(<Harness />);
    middleMouseDown(screen.getByTestId('wrapper'));
    expect(indicator()).not.toBeNull();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  });

  it('stops panning when the window loses focus', async () => {
    render(<Harness />);
    middleMouseDown(screen.getByTestId('wrapper'));
    expect(indicator()).not.toBeNull();

    // Global listeners are registered on the next tick.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(indicator()).toBeNull();
  });

  it('stops panning when the document is hidden', async () => {
    render(<Harness />);
    middleMouseDown(screen.getByTestId('wrapper'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const hidden = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(indicator()).toBeNull();

    if (hidden) {
      Object.defineProperty(document, 'visibilityState', hidden);
    } else {
      delete (document as { visibilityState?: unknown }).visibilityState;
    }
  });

  it('keeps panning after a plain middle click, and ends a held drag on release', async () => {
    render(<Harness />);
    const wrapper = screen.getByTestId('wrapper');
    const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    middleMouseDown(wrapper);
    await tick();
    window.dispatchEvent(new MouseEvent('pointerup', { button: 1 }));
    expect(indicator()).not.toBeNull();
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(indicator()).toBeNull();
    await tick();

    middleMouseDown(wrapper);
    await tick();
    window.dispatchEvent(new MouseEvent('pointermove', { buttons: 4, clientX: 80, clientY: 10 }));
    act(() => { window.dispatchEvent(new MouseEvent('pointerup', { button: 1 })); });
    expect(indicator()).toBeNull();
  });
});
