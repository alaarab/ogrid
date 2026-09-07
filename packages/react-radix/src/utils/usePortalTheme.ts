import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/** Preserve wrapper-scoped OGrid tokens when Radix portals content to the body. */
export function usePortalTheme(sourceRef: RefObject<HTMLElement | null>, open: boolean): CSSProperties {
  const [theme, setTheme] = useState<CSSProperties>({});

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
      setTheme({ ...tokens, fontFamily: computed.fontFamily, colorScheme: computed.colorScheme });
    };
    update();

    // Host themes commonly switch via classes, data-theme, or inline tokens.
    const observer = new MutationObserver(update);
    for (let ancestor: HTMLElement | null = source; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    }
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener('change', update);
    return () => {
      observer.disconnect();
      media?.removeEventListener('change', update);
    };
  }, [sourceRef, open]);

  return theme;
}
