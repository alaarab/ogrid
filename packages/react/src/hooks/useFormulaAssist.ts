/**
 * useFormulaAssist  -  Excel-style formula editing help for a text editor
 * (formula bar or inline cell editor): a function / named range autocomplete
 * list while an identifier is typed, and an argument hint while the caret is
 * inside a function call.
 *
 * Wiring is deliberately small: the editor calls `handleKeyDown` first (it
 * returns true when it consumed the key), spreads `inputProps` (ARIA only) and
 * renders `popup`. Caret tracking uses native listeners on the element, so the
 * editor's own handlers stay untouched. Inactive without a FormulaAssistContext.
 */

import * as React from 'react';
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  applyFormulaCompletion,
  getFormulaCaretContext,
  getFormulaCompletions,
  getFunctionMetadata,
  getSignatureParts,
  listFunctions,
} from '@alaarab/ogrid-core/formula';
import type { IFormulaCompletion } from '@alaarab/ogrid-core';
import { FormulaAssistContext, FormulaAssistHost } from '../components/FormulaAssist';
import type { IFormulaArgumentHint } from '../components/FormulaAssist';

type EditorElement = HTMLInputElement | HTMLTextAreaElement;

export interface UseFormulaAssistParams {
  /** Current editor text. */
  value: string;
  /** Write new editor text (after a completion is inserted). */
  onChange: (text: string) => void;
  /** The editor element (input or textarea). */
  getInput: () => EditorElement | null;
  /** False while the editor is not editing (e.g. the read-only formula bar). */
  enabled: boolean;
}

export interface UseFormulaAssistResult {
  /** Completion list is showing. */
  open: boolean;
  items: IFormulaCompletion[];
  activeIndex: number;
  hint: IFormulaArgumentHint | null;
  /**
   * Handle a keydown before the editor's own handler: Up/Down move, Tab or
   * Enter insert, Escape closes the list. Returns true when the key was used.
   */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  /** Combobox ARIA attributes for the editor element. */
  inputProps: Record<string, unknown>;
  /** The popup (portaled), or null. */
  popup: React.ReactNode;
  /** Insert the completion at `index`. */
  select: (index: number) => void;
}

// React 17 compatible stable ids (no useId).
let assistIdCounter = 0;

const visuallyHidden: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export function useFormulaAssist(params: UseFormulaAssistParams): UseFormulaAssistResult {
  const { value, onChange, getInput, enabled: enabledParam } = params;
  const config = useContext(FormulaAssistContext);
  const enabled = enabledParam && config != null;

  const idRef = useRef('');
  if (!idRef.current) idRef.current = `ogrid-formula-assist-${++assistIdCounter}`;
  const listboxId = `${idRef.current}-listbox`;
  const hintId = `${idRef.current}-hint`;
  const getOptionId = useCallback((i: number) => `${idRef.current}-option-${i}`, []);

  const [caret, setCaret] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // The token (start:prefix) the user dismissed with Escape; typing reopens.
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const getInputRef = useRef(getInput);
  getInputRef.current = getInput;
  const stableGetInput = useCallback(() => getInputRef.current(), []);

  const syncCaret = useCallback(() => {
    const el = getInputRef.current();
    if (!el) return;
    setCaret(typeof el.selectionStart === 'number' ? el.selectionStart : null);
    setFocused(typeof document !== 'undefined' && document.activeElement === el);
  }, []);

  // The text changed: re-read the caret (typing, F4, reference insertion).
  // biome-ignore lint/correctness/useExhaustiveDependencies: value is the deliberate trigger
  useLayoutEffect(() => {
    if (enabled) syncCaret();
  }, [enabled, value, syncCaret]);

  // Caret moves without text changes (arrow keys, clicks) and focus changes.
  useEffect(() => {
    if (!enabled) return;
    const el = getInputRef.current();
    if (!el) return;
    const onBlur = () => setFocused(false);
    // No 'input' listener: a state update there renders the controlled editor
    // with its old value before React's onChange runs (browsers flush the
    // microtask queue between listeners), reverting the typed text. Text
    // changes re-read the caret in the layout effect above instead.
    const events = ['keyup', 'mouseup', 'focus', 'select', 'selectionchange'] as const;
    for (const type of events) el.addEventListener(type, syncCaret);
    el.addEventListener('blur', onBlur);
    syncCaret();
    return () => {
      for (const type of events) el.removeEventListener(type, syncCaret);
      el.removeEventListener('blur', onBlur);
    };
  }, [enabled, syncCaret]);

  const functions = config?.functions;
  const namedRanges = config?.namedRanges;
  const functionList = useMemo(() => (enabled ? listFunctions(functions) : []), [enabled, functions]);

  const context = useMemo(
    () => (enabled && focused && value.startsWith('=') ? getFormulaCaretContext(value, caret ?? value.length) : null),
    [enabled, focused, value, caret],
  );
  const token = context?.token ?? null;
  const tokenKey = token ? `${token.start}:${token.prefix}` : null;

  const items = useMemo(
    () => (token && tokenKey !== dismissedKey ? getFormulaCompletions(token.prefix, functionList, namedRanges) : []),
    [token, tokenKey, dismissedKey, functionList, namedRanges],
  );
  const open = items.length > 0;

  // A new token starts at the top of the list.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tokenKey is the deliberate trigger
  useEffect(() => {
    setActiveIndex(0);
  }, [tokenKey]);

  const call = context?.call ?? null;
  const hint = useMemo<IFormulaArgumentHint | null>(() => {
    if (!call) return null;
    const meta = getFunctionMetadata(call.name, functions);
    return meta ? { parts: getSignatureParts(meta, call.argIndex), description: meta.description } : null;
  }, [call, functions]);

  const valueRef = useRef(value);
  valueRef.current = value;
  const select = useCallback(
    (index: number) => {
      const item = items[index];
      if (!token || !item) return;
      const next = applyFormulaCompletion(valueRef.current, token, item);
      const el = getInputRef.current();
      if (el) {
        // Write the DOM first so React sees an unchanged value and keeps the caret.
        el.value = next.text;
        el.setSelectionRange?.(next.caret, next.caret);
        el.focus();
      }
      onChange(next.text);
      setCaret(next.caret);
    },
    [items, token, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!open || e.nativeEvent.isComposing) return false;
      const consume = () => {
        e.preventDefault();
        e.stopPropagation();
        return true;
      };
      switch (e.key) {
        case 'ArrowDown':
          setActiveIndex((i) => (i + 1) % items.length);
          return consume();
        case 'ArrowUp':
          setActiveIndex((i) => (i - 1 + items.length) % items.length);
          return consume();
        case 'Tab':
        case 'Enter':
          if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return false;
          {
            const index = Math.min(activeIndex, items.length - 1);
            const item = items[index];
            // A fully typed named range has nothing left to insert: Enter commits.
            if (e.key === 'Enter' && item?.kind === 'name' && token && item.name === valueRef.current.slice(token.start, token.end)) {
              return false;
            }
            select(index);
          }
          return consume();
        case 'Escape':
          setDismissedKey(tokenKey);
          return consume();
        default:
          return false;
      }
    },
    [open, items, activeIndex, select, tokenKey, token],
  );

  const safeActive = Math.min(activeIndex, Math.max(0, items.length - 1));
  const inputProps = useMemo<Record<string, unknown>>(() => {
    if (!enabled) return {};
    return {
      role: 'combobox',
      'aria-autocomplete': 'list',
      'aria-expanded': open,
      'aria-controls': open ? listboxId : undefined,
      'aria-activedescendant': open ? getOptionId(safeActive) : undefined,
      'aria-describedby': !open && hint ? hintId : undefined,
    };
  }, [enabled, open, listboxId, getOptionId, safeActive, hint, hintId]);

  // Announce once when the list opens, not on every keystroke.
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    setAnnouncement(open ? 'Formula suggestions available. Use Up and Down to choose, Tab to insert.' : '');
  }, [open]);

  const Popup = config?.Popup;
  const visible = enabled && focused && (open || hint != null);
  const popup = enabled
    ? React.createElement(
        React.Fragment,
        null,
        React.createElement('span', { role: 'status', 'aria-live': 'polite', style: visuallyHidden }, announcement),
        visible && Popup
          ? React.createElement(FormulaAssistHost, {
              Popup,
              getInput: stableGetInput,
              measureKey: value,
              listboxId,
              getOptionId,
              items,
              activeIndex: safeActive,
              onSelect: select,
              onHover: setActiveIndex,
              hint: open ? null : hint,
              hintId,
            })
          : null,
      )
    : null;

  return { open, items, activeIndex: safeActive, hint, handleKeyDown, inputProps, popup, select };
}
