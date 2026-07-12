import { useState, useCallback } from 'react';
import { columnLetterToIndex } from '@alaarab/ogrid-core';

export interface UseOGridActiveCellState {
  /** The active cell reference as an A1-style string (e.g. "B3"), or null. */
  activeCellRef: string | null;
  /** Zero-based coordinates parsed from the reference, or null when unparseable. */
  activeCellCoords: { col: number; row: number } | null;
  onActiveCellChange: (ref: string | null) => void;
}

/**
 * Tracks the active cell reference (an "A1" string) and its parsed zero-based
 * { col, row } coordinates, used by the name box and formula bar.
 */
export function useOGridActiveCell(): UseOGridActiveCellState {
  const [activeCellRef, setActiveCellRef] = useState<string | null>(null);
  const [activeCellCoords, setActiveCellCoords] = useState<{ col: number; row: number } | null>(null);
  const onActiveCellChange = useCallback((ref: string | null) => {
    setActiveCellRef(ref);
    if (ref) {
      // Parse "A1"  to  { col: 0, row: 0 }
      const m = ref.match(/^([A-Z]+)(\d+)$/);
      if (m?.[1] != null && m[2] != null) {
        setActiveCellCoords({ col: columnLetterToIndex(m[1]), row: parseInt(m[2], 10) - 1 });
      } else {
        setActiveCellCoords(null);
      }
    } else {
      setActiveCellCoords(null);
    }
  }, []);

  return { activeCellRef, activeCellCoords, onActiveCellChange };
}
