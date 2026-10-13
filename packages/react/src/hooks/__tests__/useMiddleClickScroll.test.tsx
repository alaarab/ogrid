import * as React from 'react';
import { render, screen, act } from '@testing-library/react';
import { getAutoScrollVelocity, useMiddleClickScroll } from '../useMiddleClickScroll';

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

  it('does not scroll inside the dead zone and speeds up with distance', () => {
    expect(getAutoScrollVelocity(8, -8)).toEqual({ x: 0, y: 0 });
    const speeds = [40, 80, 160, 320].map((d) => getAutoScrollVelocity(0, d).y);
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeGreaterThan(speeds[i - 1] * 2);
    }
  });

  it('caps the speed and points it along the pointer offset in both axes', () => {
    const far = getAutoScrollVelocity(3000, 0);
    expect(far.x).toBe(getAutoScrollVelocity(6000, 0).x);
    expect(far.y).toBe(0);
    const diagonal = getAutoScrollVelocity(-200, 200);
    expect(diagonal.x).toBeLessThan(0);
    expect(diagonal.y).toBeCloseTo(-diagonal.x);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(Math.abs(getAutoScrollVelocity(0, Math.hypot(200, 200)).y));
  });

  it('scrolls by velocity times elapsed frame time, farther pointer scrolling faster', async () => {
    const frames: FrameRequestCallback[] = [];
    const raf = globalThis.requestAnimationFrame;
    const caf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => frames.push(cb);
    globalThis.cancelAnimationFrame = () => {};
    try {
      render(<Harness />);
      const wrapper = screen.getByTestId('wrapper');
      const run = (ms: number) => {
        for (let t = 0; t <= ms; t += 16) frames.shift()?.(1000 + t);
      };
      const travel = async (dy: number) => {
        wrapper.scrollTop = 0;
        middleMouseDown(wrapper, 100, 100);
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
        window.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, clientY: 100 + dy }));
        run(480);
        const moved = wrapper.scrollTop;
        act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
        frames.length = 0;
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
        return moved;
      };
      expect(await travel(6)).toBe(0);
      const near = await travel(60);
      const far = await travel(240);
      expect(near).toBeGreaterThan(0);
      expect(far).toBeGreaterThan(near * 4);
    } finally {
      globalThis.requestAnimationFrame = raf;
      globalThis.cancelAnimationFrame = caf;
    }
  });
});
