/**
 * Formula editing help (function autocomplete + argument hints): the context
 * that turns it on, the props a UI kit's popup receives, and the host that
 * positions that popup under the editor and portals it to <body>.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import type { IFormulaCompletion, IFormulaFunction, IFormulaSignaturePart } from '@alaarab/ogrid-core';
import { CELL_EDITOR_ATTR } from '../constants/domHelpers';
import { usePortalTheme } from '../hooks/usePortalTheme';

/** The argument hint for the function call the caret is in. */
export interface IFormulaArgumentHint {
  /** Signature split into parts; the current argument has `active: true`. */
  parts: IFormulaSignaturePart[];
  description: string;
}

/** Props a UI kit's formula assist popup renders (listbox and/or argument hint). */
export interface FormulaAssistPopupProps {
  /** Fixed position and portaled theme tokens; spread on the popup root. */
  style: React.CSSProperties;
  /** Root attributes: editor marker and a mousedown handler that keeps focus in the editor. */
  rootProps: Record<string, unknown>;
  listboxId: string;
  getOptionId: (index: number) => string;
  /** Completions to list; empty when the list is closed. */
  items: IFormulaCompletion[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
  /** Argument hint, shown when the list is closed. */
  hint: IFormulaArgumentHint | null;
  hintId: string;
}

export interface IFormulaAssistConfig {
  /** Custom functions (`formulaFunctions`), listed alongside the built-ins. */
  functions?: Record<string, IFormulaFunction>;
  /** Named ranges, listed as completions. */
  namedRanges?: Record<string, string>;
  /** The UI kit's popup. */
  Popup: React.ComponentType<FormulaAssistPopupProps>;
}

/**
 * Turns formula editing help on for formula bars and inline editors below it.
 * OGrid provides it when `formulas` is on; `null` (the default) turns it off.
 */
export const FormulaAssistContext = React.createContext<IFormulaAssistConfig | null>(null);

const ROOT_PROPS: Record<string, unknown> = {
  [CELL_EDITOR_ATTR]: '',
  // Keep focus (and the caret) in the editor when the popup is clicked.
  onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
};

const GAP = 2;
const FLIP_THRESHOLD = 240;

export interface FormulaAssistHostProps extends Omit<FormulaAssistPopupProps, 'style' | 'rootProps'> {
  Popup: React.ComponentType<FormulaAssistPopupProps>;
  getInput: () => HTMLElement | null;
  /** Re-measure when this changes (the editor text). */
  measureKey: string;
}

/** Positions the kit popup under (or above) the editor and portals it to <body>. */
export function FormulaAssistHost({ Popup, getInput, measureKey, ...popupProps }: FormulaAssistHostProps): React.ReactElement | null {
  const anchorRef = React.useRef<HTMLElement | null>(null);
  anchorRef.current = getInput();
  const theme = usePortalTheme(anchorRef, true);
  const [position, setPosition] = React.useState<React.CSSProperties | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: measureKey is the deliberate trigger — the editor can grow as text is typed
  React.useLayoutEffect(() => {
    const measure = () => {
      const el = getInput();
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      const flipUp = below < FLIP_THRESHOLD && rect.top > below;
      const next: React.CSSProperties = {
        position: 'fixed',
        left: rect.left,
        zIndex: 'var(--ogrid-z-popover, 10001)' as unknown as number,
        ...(flipUp ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      };
      setPosition((prev) =>
        prev && prev.left === next.left && prev.top === next.top && prev.bottom === next.bottom ? prev : next,
      );
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [getInput, measureKey]);

  // Keep the highlighted option in view as Up/Down move through a long list.
  const { activeIndex, getOptionId, items } = popupProps;
  React.useEffect(() => {
    if (items.length === 0) return;
    const option = document.getElementById(getOptionId(activeIndex));
    if (option && typeof option.scrollIntoView === 'function') option.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, getOptionId, items]);

  if (!position || typeof document === 'undefined') return null;
  return createPortal(<Popup {...popupProps} style={{ ...theme, ...position }} rootProps={ROOT_PROPS} />, document.body);
}
