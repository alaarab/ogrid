import { useState, useCallback, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import { normalizeSelectionRange } from '../types';
import type { ISelectionRange, IActiveCell } from '../types';
import type { IColumnDef, ICellValueChangedEvent } from '../types/columnTypes';
import { getCellValue } from '../utils';
import { parseValue } from '../utils/valueParsers';

export interface UseFillHandleParams<T> {
  items: T[];
  visibleCols: IColumnDef<T>[];
  editable?: boolean;
  onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;
  selectionRange: ISelectionRange | null;
  setSelectionRange: (range: ISelectionRange | null) => void;
  setActiveCell: (cell: IActiveCell | null) => void;
  colOffset: number;
  wrapperRef: RefObject<HTMLDivElement | null>;
  beginBatch?: () => void;
  endBatch?: () => void;
}

export interface UseFillHandleResult {
  fillDrag: { startRow: number; startCol: number } | null;
  setFillDrag: (value: { startRow: number; startCol: number } | null) => void;
  handleFillHandleMouseDown: (e: React.MouseEvent) => void;
}

export function useFillHandle<T>(params: UseFillHandleParams<T>): UseFillHandleResult {
  const {
    items,
    visibleCols,
    editable,
    onCellValueChanged,
    selectionRange,
    setSelectionRange,
    setActiveCell,
    colOffset,
    wrapperRef,
    beginBatch,
    endBatch,
  } = params;

  const [fillDrag, setFillDrag] = useState<{ startRow: number; startCol: number } | null>(null);
  const fillDragEndRef = useRef<{ endRow: number; endCol: number }>({ endRow: 0, endCol: 0 });

  useEffect(() => {
    if (!fillDrag || editable === false || !onCellValueChanged || !wrapperRef.current) return;
    fillDragEndRef.current = { endRow: fillDrag.startRow, endCol: fillDrag.startCol };
    const onMove = (e: MouseEvent) => {
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const cell = target?.closest?.('[data-row-index][data-col-index]');
      if (!cell || !wrapperRef.current?.contains(cell)) return;
      const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
      const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
      if (Number.isNaN(r) || Number.isNaN(c) || c < colOffset) return;
      const dataCol = c - colOffset;
      fillDragEndRef.current = { endRow: r, endCol: dataCol };
      const norm = normalizeSelectionRange({
        startRow: fillDrag.startRow,
        startCol: fillDrag.startCol,
        endRow: r,
        endCol: dataCol,
      });
      setSelectionRange(norm);
      setActiveCell({ rowIndex: r, columnIndex: c });
    };
    const onUp = () => {
      const end = fillDragEndRef.current;
      const norm = normalizeSelectionRange({
        startRow: fillDrag.startRow,
        startCol: fillDrag.startCol,
        endRow: end.endRow,
        endCol: end.endCol,
      });
      const startItem = items[norm.startRow];
      const startColDef = visibleCols[norm.startCol];
      if (startItem && startColDef) {
        const startValue = getCellValue(startItem, startColDef);
        beginBatch?.();
        for (let row = norm.startRow; row <= norm.endRow; row++) {
          for (let col = norm.startCol; col <= norm.endCol; col++) {
            if (row === fillDrag.startRow && col === fillDrag.startCol) continue;
            if (row >= items.length || col >= visibleCols.length) continue;
            const item = items[row];
            const colDef = visibleCols[col];
            const colEditable =
              colDef.editable === true ||
              (typeof colDef.editable === 'function' && colDef.editable(item));
            if (!colEditable) continue;
            const oldValue = getCellValue(item, colDef);
            const result = parseValue(startValue, oldValue, item, colDef);
            if (!result.valid) continue;
            onCellValueChanged({
              item,
              columnId: colDef.columnId,
              field: colDef.columnId,
              oldValue,
              newValue: result.value,
              rowIndex: row,
            });
          }
        }
        endBatch?.();
      }
      setFillDrag(null);
    };
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    return () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
    };
  }, [
    fillDrag,
    editable,
    colOffset,
    items,
    visibleCols,
    setSelectionRange,
    setActiveCell,
    onCellValueChanged,
    wrapperRef,
    beginBatch,
    endBatch,
  ]);

  const handleFillHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!selectionRange) return;
      setFillDrag({
        startRow: selectionRange.startRow,
        startCol: selectionRange.startCol,
      });
    },
    [selectionRange]
  );

  return { fillDrag, setFillDrag, handleFillHandleMouseDown };
}
