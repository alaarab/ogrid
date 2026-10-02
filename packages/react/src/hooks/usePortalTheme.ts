import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

function sameTheme(a: CSSProperties, b: CSSProperties): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const key of aKeys) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }
  return true;
}

/**
 * Preserve wrapper-scoped OGrid tokens (`--ogrid-*`, font, color-scheme) for
 * content portaled out of the grid (menus, popovers). Returns a style object
 * to spread on the portaled root; it tracks theme switches while `open`.
 */
export function usePortalTheme(sourceRef: RefObject<HTMLElement | null>, open: boolean): CSSProperties {
  const [theme, setTheme] = useState<CSSProperties>({});
  const themeRef = useRef(theme);

  useLayoutEffect(() => {
    const source = sourceRef.current;
    if (!open || !source) return;
    const update = () => {
      const computed = getComputedStyle(source);
      const tokens: Record<string, string> = {};
      for (let i = 0; i < computed.length; i++) {
        const name = computed.item(i);
        if (name.startsWith('--ogrid-')) tokens[name] = computed.getPropertyValue(name);
      }
      const next: CSSProperties = { ...tokens, fontFamily: computed.fontFamily, colorScheme: computed.colorScheme };
      // Unrelated ancestor changes (scroll locks, animation classes) leave the
      // tokens as they were: skip the state update so nothing re-renders.
      if (sameTheme(themeRef.current, next)) return;
      themeRef.current = next;
      setTheme(next);
    };
    update();

    // Coalesce bursts of mutations into one style read per frame.
    let frame: number | null = null;
    const scheduleUpdate = () => {
      if (frame != null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        update();
      });
    };

    // Host themes commonly switch via classes, data-theme, or inline tokens.
    const observer = new MutationObserver(scheduleUpdate);
    for (let ancestor: HTMLElement | null = source; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    }
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener('change', scheduleUpdate);
    return () => {
      observer.disconnect();
      media?.removeEventListener('change', scheduleUpdate);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [sourceRef, open]);

  return theme;
}
