import { useCallback, useMemo, useRef, useState } from 'react';
import { createDataValidator, getCellValue } from '@alaarab/ogrid-core';
import type { IDataValidationContext, IDataValidationRule, IDataValidationFailure, OnValidationFail } from '@alaarab/ogrid-core';
import type { ICellValueChangedEvent } from '../types';
import { useLatestRef } from './useLatestRef';

export interface DataValidationState<T> {
  validator: ReturnType<typeof createDataValidator<T>>;
  guard: (event: ICellValueChangedEvent<T>, apply: () => void, api?: boolean, sheetRow?: number) => boolean;
  alert: IDataValidationFailure<T> | null;
  respond: (accept: boolean) => void;
}

/** Central mutation gate. Rejected values never enter the undo stack or formula engine. */
export function useDataValidation<T>(params: {
  rules: IDataValidationRule<T>[] | undefined;
  context: IDataValidationContext<T>;
  sheetRow: (item: T, displayRow: number) => number;
  onValidationFail?: OnValidationFail<T>;
}): DataValidationState<T> {
  const validator = useMemo(() => createDataValidator(params.rules ?? [], params.context), [params.rules, params.context]);
  const latest = useLatestRef({ ...params, validator });
  const [alert, setAlert] = useState<IDataValidationFailure<T> | null>(null);
  const queue = useRef<{ failure: IDataValidationFailure<T>; apply?: () => void }[]>([]);
  const guard = useCallback((event: ICellValueChangedEvent<T>, apply: () => void, api = false, sheetRow?: number): boolean => {
    const st = latest.current;
    const row = sheetRow ?? st.sheetRow(event.item, event.rowIndex);
    const rule = st.validator.ruleFor(event.item, event.columnId, row);
    if (!rule || st.validator.validate(rule, event.newValue, event.columnId, row)) { apply(); return true; }
    const style = rule.errorAlert?.style ?? 'stop';
    const failure: IDataValidationFailure<T> = {
      rule, item: event.item, columnId: event.columnId, rowIndex: row, value: event.newValue, style,
      title: rule.errorAlert?.title || 'Invalid value', message: rule.errorAlert?.message || 'This value does not meet the cell’s data validation rule.',
      source: api ? 'api' : 'interactive',
    };
    const approved = st.onValidationFail?.(failure) === true;
    if (rule.errorAlert?.show === false || style === 'information' || (api && style === 'warning' && approved)) {
      apply();
      if (!api && rule.errorAlert?.show !== false) {
        queue.current.push({ failure });
        if (queue.current.length === 1) setAlert(failure);
      }
      return true;
    }
    if (!api) {
      queue.current.push({ failure, apply: style === 'warning' ? apply : undefined });
      if (queue.current.length === 1) setAlert(failure);
    }
    return false;
  }, [latest]);
  const respond = useCallback((accept: boolean) => {
    const pending = queue.current.shift();
    if (accept) pending?.apply?.();
    setAlert(queue.current[0]?.failure ?? null);
  }, []);
  return { validator, guard, alert, respond };
}

/** OGrid uses sheet data; stand-alone DataGridTable can use its displayed data. */
export function validationContextFor<T>(context: IDataValidationContext<T> | undefined, items: T[], columns: IDataValidationContext<T>['columns']): IDataValidationContext<T> {
  return context ?? { items, columns, getValue: (col, row) => {
    const item = items[row], column = columns[col];
    return item !== undefined && column ? getCellValue(item, column) : undefined;
  } };
}
