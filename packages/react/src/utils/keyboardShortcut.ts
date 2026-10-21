/**
 * Keyboard shortcuts written as `'f'`, `'Shift+F'` or `'Mod+Shift+F'` (`Mod`
 * is Ctrl or Cmd). The key matches case-insensitively; modifiers must match
 * exactly, so `'f'` does not fire with Shift or Ctrl held.
 */

interface ParsedShortcut {
  key: string;
  ctrl: boolean;
  meta: boolean;
  mod: boolean;
  alt: boolean;
  shift: boolean;
}

function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split('+').map((p) => p.trim().toLowerCase());
  // A trailing '+' is the plus key itself ('Shift++').
  const key = shortcut.endsWith('+') ? '+' : (parts.pop() ?? '');
  const mods = new Set(parts.filter(Boolean));
  return {
    key,
    ctrl: mods.has('ctrl') || mods.has('control'),
    meta: mods.has('meta') || mods.has('cmd'),
    mod: mods.has('mod'),
    alt: mods.has('alt') || mods.has('option'),
    shift: mods.has('shift'),
  };
}

/** True when the shortcut has no modifier (typing it could be text entry). */
export function isPlainShortcut(shortcut: string): boolean {
  const p = parseShortcut(shortcut);
  return !p.ctrl && !p.meta && !p.mod && !p.alt && !p.shift;
}

export function matchesShortcut(
  e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean },
  shortcut: string,
): boolean {
  const p = parseShortcut(shortcut);
  if (!p.key || e.key.toLowerCase() !== p.key) return false;
  if (p.alt !== e.altKey || p.shift !== e.shiftKey) return false;
  if (p.mod) return (e.ctrlKey || e.metaKey) && !(p.ctrl && !e.ctrlKey) && !(p.meta && !e.metaKey);
  return p.ctrl === e.ctrlKey && p.meta === e.metaKey;
}
