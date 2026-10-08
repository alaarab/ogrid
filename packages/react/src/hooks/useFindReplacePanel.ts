/**
 * Keyboard and focus behavior shared by the kits' Find & Replace panels:
 * Enter / Shift+Enter walk matches, Enter in the replace box replaces,
 * Escape closes, Ctrl+F / Ctrl+H inside the panel switch mode instead of
 * opening the browser's find, and the find input takes focus on every open.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type * as React from 'react';
import type { FindReplacePanelProps } from '../components/BaseDataGridTable.types';

let panelCounter = 0;

export interface UseFindReplacePanelResult {
  /** Attach to the find input. */
  findInputRef: React.RefObject<HTMLInputElement | null>;
  /** Attach to the replace input. */
  replaceInputRef: React.RefObject<HTMLInputElement | null>;
  /** Unique id prefix for labels (`${idPrefix}-find`, `${idPrefix}-replace`, …). */
  idPrefix: string;
  /** onKeyDown for the panel root (Escape, Ctrl+F, Ctrl+H). */
  onPanelKeyDown: (e: React.KeyboardEvent) => void;
  /** onKeyDown for the find input (Enter = next, Shift+Enter = previous). */
  onFindKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** onKeyDown for the replace input (Enter = replace). */
  onReplaceKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function useFindReplacePanel({ find, onClose, focusRequest }: FindReplacePanelProps): UseFindReplacePanelResult {
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [idPrefix] = useState(() => `ogrid-find-${++panelCounter}`);
  const { mode, setMode, next, prev, replace } = find;

  // Focus and select the query on every open (Ctrl+F again re-selects it).
  // biome-ignore lint/correctness/useExhaustiveDependencies: focusRequest is the trigger
  useEffect(() => {
    const input = findInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [focusRequest]);

  const onPanelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      const key = e.key.toLowerCase();
      if (key === 'f') {
        e.preventDefault();
        setMode('find');
        findInputRef.current?.focus();
        findInputRef.current?.select();
      } else if (key === 'h') {
        e.preventDefault();
        setMode('replace');
        // The replace row mounts on this render; focus it once it exists.
        requestAnimationFrame(() => replaceInputRef.current?.focus());
      }
    }
  }, [onClose, setMode]);

  const onFindKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (e.shiftKey) prev();
    else next();
  }, [next, prev]);

  const onReplaceKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (mode === 'replace') replace();
  }, [mode, replace]);

  return { findInputRef, replaceInputRef, idPrefix, onPanelKeyDown, onFindKeyDown, onReplaceKeyDown };
}
