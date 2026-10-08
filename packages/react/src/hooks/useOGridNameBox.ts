import { useCallback, useMemo, useRef } from 'react';
import { parseSheetReference } from '@alaarab/ogrid-core';
import { useLatestRef } from './useLatestRef';
import type { IGridCellNavigator } from '../types';

export interface UseOGridNameBoxResult {
  /** Handed to the grid, which fills it with its navigator. */
  cellNavigatorRef: React.MutableRefObject<IGridCellNavigator | null>;
  /** Name box Enter: select the typed reference or defined name. False when it isn't one the grid shows. */
  navigate: (text: string) => boolean;
  /** Name box Escape: back to the grid's active cell. */
  returnFocus: () => void;
}

/** Name box navigation: parses what the user typed and asks the grid to select it. */
export function useOGridNameBox(namedRanges: Readonly<Record<string, string>> | undefined): UseOGridNameBoxResult {
  const cellNavigatorRef = useRef<IGridCellNavigator | null>(null);
  const namedRangesRef = useLatestRef(namedRanges);
  const navigate = useCallback((text: string) => {
    const ref = parseSheetReference(text, namedRangesRef.current);
    return ref != null && (cellNavigatorRef.current?.selectRange(ref) ?? false);
  }, [namedRangesRef]);
  const returnFocus = useCallback(() => cellNavigatorRef.current?.focusActiveCell(), []);
  return useMemo(() => ({ cellNavigatorRef, navigate, returnFocus }), [navigate, returnFocus]);
}
