/**
 * Clipboard state and event plumbing shared by `<OGrid>`'s `useClipboard` and
 * the headless `useCellClipboard`, so the two cannot drift apart. Internal:
 * not exported from the package.
 */
import { useCallback, useRef, useState } from 'react';
import type { ICutSource, ISelectionRange } from '@alaarab/ogrid-core';

/** Text-entry controls whose keystrokes and clipboard events never belong to the grid. */
export const TEXT_ENTRY_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select, [contenteditable=""], [contenteditable="true"]';

/** The text a native or React `paste` event carries ('' when none). */
export function getPastedText(data: Pick<DataTransfer, 'getData'> | null | undefined): string {
  return data?.getData('text/plain') || data?.getData('text') || '';
}

export interface ClipboardMarks {
  /** The marked cut range (marching ants), or null. */
  cutRange: ISelectionRange | null;
  /** The marked copy range (marching ants), or null. */
  copyRange: ISelectionRange | null;
  /** Mark `range` as copied. A copy replaces any pending cut. */
  markCopied: (range: ISelectionRange) => void;
  /** Mark `range` as cut, with its identity-captured source. A cut replaces any copy mark. */
  markCut: (range: ISelectionRange, source: ICutSource) => void;
  /** Clear both marks after a paste and hand back the pending cut to complete, if any. */
  takePendingCut: () => ICutSource | null;
  /** Clear both marks and drop any pending cut (Escape). */
  clearMarks: () => void;
}

/**
 * Copy/cut marks and the pending cut. Every callback is stable.
 */
export function useClipboardMarks(): ClipboardMarks {
  const [cutRange, setCutRange] = useState<ISelectionRange | null>(null);
  const [copyRange, setCopyRange] = useState<ISelectionRange | null>(null);
  const pendingCutRef = useRef<ICutSource | null>(null);

  const markCopied = useCallback((range: ISelectionRange) => {
    pendingCutRef.current = null;
    setCutRange(null);
    setCopyRange(range);
  }, []);

  const markCut = useCallback((range: ISelectionRange, source: ICutSource) => {
    pendingCutRef.current = source;
    setCutRange(range);
    setCopyRange(null);
  }, []);

  const takePendingCut = useCallback((): ICutSource | null => {
    const cut = pendingCutRef.current;
    pendingCutRef.current = null;
    setCutRange(null);
    setCopyRange(null);
    return cut;
  }, []);

  const clearMarks = useCallback(() => {
    takePendingCut();
  }, [takePendingCut]);

  return { cutRange, copyRange, markCopied, markCut, takePendingCut, clearMarks };
}
