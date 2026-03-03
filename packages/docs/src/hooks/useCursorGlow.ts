import { useRef, useEffect, useCallback, type RefObject } from 'react';

/**
 * useCursorGlow
 *
 * Tracks mouse position relative to the ref'd element and sets
 * --cursor-x and --cursor-y CSS custom properties on it.
 *
 * Use alongside the .cursorGlow class in micro-interactions.scss
 * for a radial glow that follows the cursor.
 *
 * SSR-safe: no window/document access during server render.
 * Debounced via requestAnimationFrame for smooth, non-janky updates.
 */
export function useCursorGlow<T extends HTMLElement = HTMLDivElement>(): {
  ref: RefObject<T>;
} {
  const ref = useRef<T>(null);
  const rafId = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;

    // Cancel any pending frame to avoid stale updates
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
    }

    rafId.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      el.style.setProperty('--cursor-x', String(x));
      el.style.setProperty('--cursor-y', String(y));

      // Also expose normalized 0–1 values for .hoverTilt
      el.style.setProperty('--mouse-x', String(x / rect.width));
      el.style.setProperty('--mouse-y', String(y / rect.height));

      rafId.current = null;
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }

    // Reset to center so glow fades cleanly
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--cursor-x', String(rect.width / 2));
    el.style.setProperty('--cursor-y', String(rect.height / 2));
    el.style.setProperty('--mouse-x', '0.5');
    el.style.setProperty('--mouse-y', '0.5');
  }, []);

  useEffect(() => {
    // SSR guard
    if (typeof window === 'undefined') return;

    const el = ref.current;
    if (!el) return;

    el.addEventListener('mousemove', handleMouseMove, { passive: true });
    el.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);

      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [handleMouseMove, handleMouseLeave]);

  return { ref };
}
