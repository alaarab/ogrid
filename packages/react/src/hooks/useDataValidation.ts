import { useCallback, useMemo, useRef, useState } from 'react';
import { createDataValidator, getCellValue } from '@alaarab/ogrid-core';
import type { IDataValidationContext, IDataValidationRule, IDataValidationFailure, OnValidationFail } from '@alaarab/ogrid-core';
import type { ICellValueChangedEvent } from '../types';
import { useLatestRef } from './useLatestRef';

export interface DataValidationState<T> {
  validator: ReturnType<typeof createDataValidator<T>>;
  guard: (event: ICellValueChangedEvent<T>, apply: () => void, api?: boolean, sheetRow?: number) => boolean;
  beginBatch: (begin: () => void, end: () => void, atomic?: boolean) => void;
  endBatch: () => void;
  afterBatch: (action: () => void) => void;
  stage: (action: () => void) => void;
  alert: IDataValidationFailure<T> | null;
  respond: (accept: boolean) => void;
}

interface ValidationBatch {
  begin: () => void;
  end: () => void;
  changes: { apply?: () => void }[];
  after: (() => void)[];
  pending: number;
  closed: boolean;
  depth: number;
  failed: boolean;
  atomic: boolean;
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
  const queue = useRef<{ failure: IDataValidationFailure<T>; respond?: (accept: boolean) => void }[]>([]);
  const batch = useRef<ValidationBatch | null>(null);
  const finish = useCallback((operation: ValidationBatch) => {
    if (!operation.closed || operation.pending) return;
    if (operation.atomic && operation.failed) return;
    const previous = batch.current;
    batch.current = operation;
    operation.begin();
    try {
      for (const change of operation.changes) change.apply?.();
      for (const action of operation.after) action();
    } finally { batch.current = previous; operation.end(); }
  }, []);
  const beginBatch = useCallback((begin: () => void, end: () => void, atomic = false) => {
    if (batch.current) { batch.current.depth++; return; }
    batch.current = { begin, end, changes: [], after: [], pending: 0, closed: false, depth: 1, failed: false, atomic };
  }, []);
  const endBatch = useCallback(() => {
    const operation = batch.current;
    if (!operation || --operation.depth > 0) return;
    batch.current = null;
    operation.closed = true;
    finish(operation);
  }, [finish]);
  const afterBatch = useCallback((action: () => void) => {
    if (batch.current) batch.current.after.push(action);
    else action();
  }, []);
  const stage = useCallback((action: () => void) => {
    if (batch.current && !batch.current.closed) batch.current.changes.push({ apply: action });
    else action();
  }, []);
  const guard = useCallback((event: ICellValueChangedEvent<T>, apply: () => void, api = false, sheetRow?: number): boolean => {
    const st = latest.current;
    const operation = batch.current;
    const change: { apply?: () => void } = {};
    if (operation && !operation.closed) operation.changes.push(change);
    const commit = () => {
      if (operation && !operation.closed) change.apply = apply;
      else apply();
    };
    const row = sheetRow ?? st.sheetRow(event.item, event.rowIndex);
    const rule = st.validator.ruleFor(event.item, event.columnId, row);
    if (!rule || st.validator.validate(rule, event.newValue, event.columnId, row)) { commit(); return true; }
    const style = rule.errorAlert?.style ?? 'stop';
    const failure: IDataValidationFailure<T> = {
      rule, item: event.item, columnId: event.columnId, rowIndex: row, value: event.newValue, style,
      title: rule.errorAlert?.title || 'Invalid value', message: rule.errorAlert?.message || 'This value does not meet the cell’s data validation rule.',
      source: api ? 'api' : 'interactive',
    };
    const approved = st.onValidationFail?.(failure) === true;
    if (rule.errorAlert?.show === false || style === 'information' || (api && style === 'warning' && approved)) {
      commit();
      if (!api && rule.errorAlert?.show !== false) {
        queue.current.push({ failure });
        if (queue.current.length === 1) setAlert(failure);
      }
      return true;
    }
    if (api && operation) operation.failed = true;
    if (!api) {
      if (operation && style === 'warning') operation.pending++;
      if (operation && style !== 'warning') operation.failed = true;
      queue.current.push({ failure, respond: style === 'warning' ? (accept) => {
        if (operation) {
          if (accept) change.apply = apply;
          else operation.failed = true;
          operation.pending--;
          finish(operation);
        } else if (accept) apply();
      } : undefined });
      if (queue.current.length === 1) setAlert(failure);
    }
    return false;
  }, [latest, finish]);
  const respond = useCallback((accept: boolean) => {
    const pending = queue.current.shift();
    pending?.respond?.(accept);
    setAlert(queue.current[0]?.failure ?? null);
  }, []);
  return { validator, guard, alert, respond, beginBatch, endBatch, afterBatch, stage };
}

/** OGrid uses sheet data; stand-alone DataGridTable can use its displayed data. */
export function validationContextFor<T>(context: IDataValidationContext<T> | undefined, items: T[], columns: IDataValidationContext<T>['columns']): IDataValidationContext<T> {
  return context ?? { items, columns, getValue: (col, row) => {
    const item = items[row], column = columns[col];
    return item !== undefined && column ? getCellValue(item, column) : undefined;
  } };
}
