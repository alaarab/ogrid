import { useEffect } from 'react';
import type { RefObject } from 'react';

export interface UseMiddleClickScrollParams {
  wrapperRef: RefObject<HTMLElement | null>;
}

/** Dead zone in px around the origin — no scrolling inside this radius. */
const DEAD_ZONE = 12;
/** Scroll speed multiplier: px/frame per pixel of distance beyond dead zone. */
const SPEED_SCALE = 0.06;
/** Maximum scroll speed in px/frame. */
const MAX_SPEED = 25;

/**
 * Enables middle-click (button 1) auto-scroll on a scrollable container.
 *
 * Middle-click shows a small origin indicator; moving the mouse away from
 * the origin scrolls the container in that direction. Speed is proportional
 * to distance. Any subsequent click or Escape cancels the auto-scroll.
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
    let indicator: HTMLDivElement | null = null;
    let rafId = 0;

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
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx <= DEAD_ZONE && absDy <= DEAD_ZONE) {
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

    function scrollLoop() {
      if (!active) return;
      const dx = currentX - originX;
      const dy = currentY - originY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      let sx = 0;
      let sy = 0;

      if (absDx > DEAD_ZONE) {
        sx = Math.sign(dx) * Math.min((absDx - DEAD_ZONE) * SPEED_SCALE, MAX_SPEED);
      }
      if (absDy > DEAD_ZONE) {
        sy = Math.sign(dy) * Math.min((absDy - DEAD_ZONE) * SPEED_SCALE, MAX_SPEED);
      }

      if (sx !== 0 || sy !== 0) {
        wrapper.scrollLeft += sx;
        wrapper.scrollTop += sy;
      }

      rafId = requestAnimationFrame(scrollLoop);
    }

    // ── Global listeners (added only while panning) ────────────────────────

    function onMouseMove(e: MouseEvent) {
      currentX = e.clientX;
      currentY = e.clientY;
      updateCursor(currentX - originX, currentY - originY);
    }

    function onGlobalMouseDown() {
      // Any click anywhere stops the pan.
      stopPan();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopPan();
      }
    }

    // ── Start / stop ───────────────────────────────────────────────────────

    function startPan(x: number, y: number) {
      active = true;
      originX = x;
      originY = y;
      currentX = x;
      currentY = y;
      indicator = createIndicator(x, y);
      document.body.style.cursor = 'all-scroll';
      rafId = requestAnimationFrame(scrollLoop);

      // Defer global listener registration so the initiating mousedown
      // event doesn't immediately trigger the stop handler.
      setTimeout(() => {
        if (!active) return;
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mousedown', onGlobalMouseDown, true);
        window.addEventListener('keydown', onKeyDown, true);
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

      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onGlobalMouseDown, true);
      window.removeEventListener('keydown', onKeyDown, true);

      // Reset cooldown after the current event cycle completes so the
      // stopping click doesn't immediately re-trigger a new pan.
      setTimeout(() => { cooldown = false; }, 0);
    }

    // ── Wrapper listener (always attached) ─────────────────────────────────

    function onWrapperMouseDown(e: MouseEvent) {
      if (e.button !== 1) return;
      e.preventDefault();
      if (cooldown) return;
      if (active) { stopPan(); return; }
      startPan(e.clientX, e.clientY);
    }

    // Prevent native autoscroll and middle-click paste on the wrapper.
    function onWrapperAuxClick(e: MouseEvent) {
      if (e.button === 1) e.preventDefault();
    }

    wrapper.addEventListener('mousedown', onWrapperMouseDown);
    wrapper.addEventListener('auxclick', onWrapperAuxClick);

    return () => {
      wrapper.removeEventListener('mousedown', onWrapperMouseDown);
      wrapper.removeEventListener('auxclick', onWrapperAuxClick);
      if (active) stopPan();
    };
  }, [wrapperRef]);
}
