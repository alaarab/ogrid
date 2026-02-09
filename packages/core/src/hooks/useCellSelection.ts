import { useState, useCallback, useRef, useEffect } from 'react';
import { normalizeSelectionRange } from '../types';
import type { ISelectionRange, IActiveCell } from '../types';

export interface UseCellSelectionParams {
  colOffset: number;
  rowCount: number;
  visibleColCount: number;
  setActiveCell: (cell: IActiveCell | null) => void;
}

export interface UseCellSelectionResult {
  selectionRange: ISelectionRange | null;
  setSelectionRange: (range: ISelectionRange | null) => void;
  handleCellMouseDown: (e: React.MouseEvent, rowIndex: number, globalColIndex: number) => void;
  handleSelectAllCells: () => void;
  /** True while the user is drag-selecting cells (mousedown → mousemove → mouseup). */
  isDragging: boolean;
}

export function useCellSelection(params: UseCellSelectionParams): UseCellSelectionResult {
  const { colOffset, rowCount, visibleColCount, setActiveCell } = params;

  const [selectionRange, setSelectionRange] = useState<ISelectionRange | null>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ row: number; col: number } | null>(null);

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent, rowIndex: number, globalColIndex: number) => {
      if (globalColIndex < colOffset) return;
      // Prevent native text selection during cell drag
      e.preventDefault();
      const dataColIndex = globalColIndex - colOffset;
      if (e.shiftKey && selectionRange != null) {
        setSelectionRange(
          normalizeSelectionRange({
            startRow: selectionRange.startRow,
            startCol: selectionRange.startCol,
            endRow: rowIndex,
            endCol: dataColIndex,
          })
        );
        setActiveCell({ rowIndex, columnIndex: globalColIndex });
      } else {
        dragStartRef.current = { row: rowIndex, col: dataColIndex };
        setSelectionRange({
          startRow: rowIndex,
          startCol: dataColIndex,
          endRow: rowIndex,
          endCol: dataColIndex,
        });
        setActiveCell({ rowIndex, columnIndex: globalColIndex });
        isDraggingRef.current = true;
        setIsDragging(true);
      }
    },
    [colOffset, selectionRange, setActiveCell]
  );

  const handleSelectAllCells = useCallback(() => {
    if (rowCount === 0 || visibleColCount === 0) return;
    setSelectionRange({
      startRow: 0,
      startCol: 0,
      endRow: rowCount - 1,
      endCol: visibleColCount - 1,
    });
    setActiveCell({ rowIndex: 0, columnIndex: colOffset });
  }, [rowCount, visibleColCount, colOffset, setActiveCell]);

  // Window mouse move/up for drag selection
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const cell = (target as HTMLElement)?.closest?.('[data-row-index][data-col-index]');
      if (!cell) return;
      const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
      const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
      if (Number.isNaN(r) || Number.isNaN(c) || c < colOffset) return;
      const dataCol = c - colOffset;
      const start = dragStartRef.current;
      setSelectionRange(
        normalizeSelectionRange({
          startRow: start.row,
          startCol: start.col,
          endRow: r,
          endCol: dataCol,
        })
      );
      setActiveCell({ rowIndex: r, columnIndex: c });
    };
    const onUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    return () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
    };
  }, [colOffset, setActiveCell]);

  return {
    selectionRange,
    setSelectionRange,
    handleCellMouseDown,
    handleSelectAllCells,
    isDragging,
  };
}
