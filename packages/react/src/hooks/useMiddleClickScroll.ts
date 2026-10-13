import { useEffect } from 'react';
import type { RefObject } from 'react';

export interface UseMiddleClickScrollParams {
  wrapperRef: RefObject<HTMLElement | null>;
}

const DEAD_ZONE = 12;
const RAMP_DISTANCE = 320;
const MAX_SPEED = 2400;
const MAX_FRAME_MS = 50;

export interface AutoScrollVelocity {
  x: number;
  y: number;
}

export function getAutoScrollVelocity(dx: number, dy: number): AutoScrollVelocity {
  const distance = Math.hypot(dx, dy);
  if (distance <= DEAD_ZONE) return { x: 0, y: 0 };
  const t = Math.min(1, (distance - DEAD_ZONE) / RAMP_DISTANCE);
  const speed = MAX_SPEED * t * t;
  return { x: (speed * dx) / distance, y: (speed * dy) / distance };
}

/**
 * Interactive targets keep their native middle-click behaviour (e.g. opening a
 * link in a new tab) instead of starting a pan.
 */
const INTERACTIVE_TARGET_SELECTOR =
  'a,[href],button,input,textarea,select,[contenteditable]:not([contenteditable="false"])';

/**
 * Enables middle-click (button 1) auto-scroll on a scrollable container.
 *
 * Middle-click shows a small origin indicator; moving the mouse away from
 * the origin scrolls the container in that direction. Outside a dead zone,
 * speed grows with distance from the origin up to a cap. Any subsequent click or Escape cancels the auto-scroll.
 * Holding the middle button and dragging pans until the button is released.
 *
 * Listens for pointer events, not mouse events: grid cells cancel
 * `pointerdown`, which makes the browser skip the compatibility `mousedown`.
 */
export function useMiddleClickScroll({ wrapperRef }: UseMiddleClickScrollParams): void {
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    // Non-null alias used inside closures so TS narrows correctly.
    const wrapper: HTMLElement = el;

    let active = false;
    /** Prevents the stopping click from immediately re-starting a pan. */
    let cooldown = false;
    let originX = 0;
    let originY = 0;
    let currentX = 0;
    let currentY = 0;
    /** The middle button moved past the dead zone while held: release ends the pan. */
    let dragged = false;
    let indicator: HTMLDivElement | null = null;
    let rafId = 0;
    let lastFrame = 0;
    let carryX = 0;
    let carryY = 0;

    // ── Indicator ──────────────────────────────────────────────────────────

    function createIndicator(x: number, y: number): HTMLDivElement {
      const el = document.createElement('div');
      el.setAttribute('data-ogrid-scroll-indicator', '');
      el.innerHTML =
        '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="11" cy="11" r="10" fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.3)" stroke-width="1.2"/>' +
        '<circle cx="11" cy="11" r="2" fill="rgba(0,0,0,0.45)"/>' +
        '<polygon points="11,3 8.5,6 13.5,6" fill="rgba(0,0,0,0.35)"/>' +
        '<polygon points="11,19 8.5,16 13.5,16" fill="rgba(0,0,0,0.35)"/>' +
        '<polygon points="3,11 6,8.5 6,13.5" fill="rgba(0,0,0,0.35)"/>' +
        '<polygon points="19,11 16,8.5 16,13.5" fill="rgba(0,0,0,0.35)"/>' +
        '</svg>';
      el.style.cssText =
        `position:fixed;left:${x - 11}px;top:${y - 11}px;width:22px;height:22px;` +
        'z-index:10000;pointer-events:none;';
      document.body.appendChild(el);
      return el;
    }

    function removeIndicator() {
      indicator?.remove();
      indicator = null;
    }

    // ── Cursor ─────────────────────────────────────────────────────────────

    function updateCursor(dx: number, dy: number) {
      if (Math.hypot(dx, dy) <= DEAD_ZONE) {
        document.body.style.cursor = 'all-scroll';
        return;
      }
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      let cursor: string;
      if (angle > -22.5 && angle <= 22.5) cursor = 'e-resize';
      else if (angle > 22.5 && angle <= 67.5) cursor = 'se-resize';
      else if (angle > 67.5 && angle <= 112.5) cursor = 's-resize';
      else if (angle > 112.5 && angle <= 157.5) cursor = 'sw-resize';
      else if (angle > 157.5 || angle <= -157.5) cursor = 'w-resize';
      else if (angle > -157.5 && angle <= -112.5) cursor = 'nw-resize';
      else if (angle > -112.5 && angle <= -67.5) cursor = 'n-resize';
      else cursor = 'ne-resize';
      document.body.style.cursor = cursor;
    }

    // ── Scroll loop ────────────────────────────────────────────────────────

    function scrollLoop(now: number) {
      if (!active) return;
      const elapsed = lastFrame ? Math.min(now - lastFrame, MAX_FRAME_MS) : 0;
      lastFrame = now;
      const velocity = getAutoScrollVelocity(currentX - originX, currentY - originY);
      if (velocity.x === 0 && velocity.y === 0) {
        carryX = 0;
        carryY = 0;
      } else {
        carryX += (velocity.x * elapsed) / 1000;
        carryY += (velocity.y * elapsed) / 1000;
        const stepX = Math.trunc(carryX);
        const stepY = Math.trunc(carryY);
        carryX -= stepX;
        carryY -= stepY;
        if (stepX !== 0) wrapper.scrollLeft += stepX;
        if (stepY !== 0) wrapper.scrollTop += stepY;
      }
      rafId = requestAnimationFrame(scrollLoop);
    }

    // ── Global listeners (added only while panning) ────────────────────────

    function onPointerMove(e: PointerEvent) {
      currentX = e.clientX;
      currentY = e.clientY;
      const dx = currentX - originX;
      const dy = currentY - originY;
      if ((e.buttons & 4) && Math.hypot(dx, dy) > DEAD_ZONE) dragged = true;
      updateCursor(dx, dy);
    }

    function onGlobalPointerDown() {
      // Any click anywhere stops the pan.
      stopPan();
    }

    function onPointerUp(e: PointerEvent) {
      if (e.button === 1 && dragged) stopPan();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopPan();
      }
    }

    // A pan must not keep scrolling while the window is unfocused/hidden.
    function onWindowBlur() {
      stopPan();
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') stopPan();
    }

    // ── Start / stop ───────────────────────────────────────────────────────

    function startPan(x: number, y: number) {
      active = true;
      originX = x;
      originY = y;
      currentX = x;
      currentY = y;
      dragged = false;
      lastFrame = 0;
      carryX = 0;
      carryY = 0;
      indicator = createIndicator(x, y);
      document.body.style.cursor = 'all-scroll';
      rafId = requestAnimationFrame(scrollLoop);

      // Defer global listener registration so the initiating mousedown
      // event doesn't immediately trigger the stop handler.
      setTimeout(() => {
        if (!active) return;
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerdown', onGlobalPointerDown, true);
        window.addEventListener('pointerup', onPointerUp, true);
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('blur', onWindowBlur);
        document.addEventListener('visibilitychange', onVisibilityChange);
      }, 0);
    }

    function stopPan() {
      if (!active) return;
      active = false;
      cooldown = true;

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      removeIndicator();
      document.body.style.cursor = '';

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onGlobalPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);

      // Reset cooldown after the current event cycle completes so the
      // stopping click doesn't immediately re-trigger a new pan.
      setTimeout(() => { cooldown = false; }, 0);
    }

    // ── Wrapper listener (always attached) ─────────────────────────────────

    function onWrapperPointerDown(e: PointerEvent) {
      if (e.button !== 1) return;
      const target = e.target as Element | null;
      if (target?.closest?.(INTERACTIVE_TARGET_SELECTOR)) return;
      e.preventDefault();
      if (cooldown) return;
      if (active) { stopPan(); return; }
      startPan(e.clientX, e.clientY);
    }

    // Prevent native autoscroll and middle-click paste on the wrapper, except
    // over interactive targets (where middle-click should reach the element).
    function onWrapperAuxClick(e: MouseEvent) {
      if (e.button !== 1) return;
      const target = e.target as Element | null;
      if (target?.closest?.(INTERACTIVE_TARGET_SELECTOR)) return;
      e.preventDefault();
    }

    wrapper.addEventListener('pointerdown', onWrapperPointerDown);
    wrapper.addEventListener('auxclick', onWrapperAuxClick);

    return () => {
      wrapper.removeEventListener('pointerdown', onWrapperPointerDown);
      wrapper.removeEventListener('auxclick', onWrapperAuxClick);
      if (active) stopPan();
    };
  }, [wrapperRef]);
}
