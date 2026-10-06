import { useEffect, useMemo, useRef } from 'react';
import { validateColumns, validateRowIds } from '@alaarab/ogrid-core';
import type { IColumnDef } from '@alaarab/ogrid-core';
import type { RowId } from '../types';

/** Dev-time column validation, once per distinct set of column ids (not per `columns` identity). */
export function useColumnValidation<T>(columns: IColumnDef<T>[]): void {
  const columnIdsKey = useMemo(
    () => columns.map((c) => c.columnId).join('\u0000'),
    [columns]
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: validate once per distinct columnId set, not on every new columns array identity
  useEffect(() => {
    validateColumns(columns as Parameters<typeof validateColumns>[0]);
  }, [columnIdsKey]);
}

/** Validates row ids once, on the first render that has rows. */
export function useRowIdValidation<T>(items: T[], getRowId: (item: T) => RowId): void {
  const validatedRef = useRef(false);
  useEffect(() => {
    if (!validatedRef.current && items.length > 0) {
      validatedRef.current = true;
      validateRowIds(items, getRowId);
    }
  }, [items, getRowId]);
}
