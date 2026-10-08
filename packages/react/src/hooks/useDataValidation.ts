import { useCallback, useMemo, useRef, useState } from 'react';
import { createDataValidator, getCellValue, indexToColumnLetter } from '@alaarab/ogrid-core';
import type { IDataValidationContext, IDataValidationRule, IDataValidationFailure, OnValidationFail } from '@alaarab/ogrid-core';
import type { ICellValueChangedEvent } from '../types';
import { useLatestRef } from './useLatestRef';

export interface DataValidationState<T> {
  validator: ReturnType<typeof createDataValidator<T>>;
  guard: (event: ICellValueChangedEvent<T>, apply: () => void, api?: boolean, sheetRow?: number) => boolean;
  beginBatch: (begin: () => void, end: () => void, atomic?: boolean) => void;
  endBatch: () => void;
  afterBatch: (action: () => void) => void;
  previewClears: (read: (accepted: (row: number, columnId: string) => boolean) => ICellValueChangedEvent<T>[]) => void;
  stage: (action: () => void, event?: ICellValueChangedEvent<T>) => void;
  alert: IDataValidationFailure<T> | null;
  respond: (accept: boolean) => void;
}

interface ValidationChange<T> {
  apply?: () => void;
  event?: ICellValueChangedEvent<T>;
  row?: number;
  api?: boolean;
  approved?: boolean;
}
interface ValidationBatch<T> {
  begin: () => void;
  end: () => void;
  changes: ValidationChange<T>[];
  after: (() => void)[];
  clears: ((accepted: (row: number, columnId: string) => boolean) => ICellValueChangedEvent<T>[])[];
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
  const batch = useRef<ValidationBatch<T> | null>(null);
  const checkRef = useRef<(operation: ValidationBatch<T>) => void>(() => {});
  const finish = useCallback((operation: ValidationBatch<T>) => {
    if (!operation.closed || operation.pending) return;
    checkRef.current(operation);
    if (operation.pending) return;
    operation.begin();
    try {
      if (!operation.atomic || !operation.failed) {
        for (const change of operation.changes) change.apply?.();
        for (const action of operation.after) action();
      }
    } finally { operation.end(); }
  }, []);
  const beginBatch = useCallback((begin: () => void, end: () => void, atomic = false) => {
    if (batch.current) { batch.current.depth++; return; }
    batch.current = { begin, end, changes: [], after: [], clears: [], pending: 0, closed: false, depth: 1, failed: false, atomic };
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
  const previewClears = useCallback((read: ValidationBatch<T>['clears'][number]) => { batch.current?.clears.push(read); }, []);
  const stage = useCallback((action: () => void, event?: ICellValueChangedEvent<T>) => {
    if (batch.current && !batch.current.closed) batch.current.changes.push({ apply: action, event, row: event && latest.current.sheetRow(event.item, event.rowIndex), approved: true });
    else action();
  }, [latest]);
  const decide = useCallback((change: ValidationChange<T>, currentValidator: typeof validator, operation?: ValidationBatch<T>): boolean => {
    const st = latest.current;
    const { event, row = 0, api = false } = change;
    if (!event || change.approved) return true;
    const rule = currentValidator.ruleFor(event.item, event.columnId, row);
    if (!rule || currentValidator.validate(rule, event.newValue, event.columnId, row)) return true;
    const style = rule.errorAlert?.style ?? 'stop';
    const failure: IDataValidationFailure<T> = {
      rule, item: event.item, columnId: event.columnId, rowIndex: row, value: event.newValue, style,
      title: rule.errorAlert?.title || 'Invalid value', message: rule.errorAlert?.message || 'This value does not meet the cell’s data validation rule.',
      source: api ? 'api' : 'interactive',
    };
    const notify = (respond?: (accept: boolean) => void) => {
      queue.current.push({ failure, respond });
      if (queue.current.length === 1) setAlert(failure);
    };
    const approved = st.onValidationFail?.(failure) === true;
    if (rule.errorAlert?.show === false || style === 'information' || (api && style === 'warning' && approved)) {
      change.approved = true;
      if (!api && rule.errorAlert?.show !== false) notify();
      return true;
    }
    const apply = change.apply;
    change.apply = undefined;
    if (operation && (api || style !== 'warning')) operation.failed = true;
    if (!api) {
      if (operation && style === 'warning') operation.pending++;
      notify(style === 'warning' ? (accept) => {
        if (operation) {
          if (accept) { change.apply = apply; change.approved = true; }
          else operation.failed = true;
          operation.pending--;
          finish(operation);
        } else if (accept) apply?.();
      } : undefined);
    }
    return false;
  }, [latest, finish]);
  checkRef.current = operation => {
    const st = latest.current;
    if (!st.rules?.length) return;
    // Recheck survivors after a rejection: their dependencies now see the
    // original value of the rejected cell. Each pass removes at least one write.
    let removed: boolean;
    do {
      const entries = operation.changes.filter(change => change.apply && change.event);
      const clears = operation.clears.flatMap(read => read((row, id) => entries.some(change => change.event?.rowIndex === row && change.event.columnId === id)));
      const changes = [...entries, ...clears.map(event => ({ event, row: st.sheetRow(event.item, event.rowIndex) }))].map(change => ({
        col: st.context.columns.findIndex(col => col.columnId === change.event?.columnId), row: change.row ?? 0, value: change.event?.newValue,
      }));
      const currentValidator = createDataValidator(st.rules ?? [], {
        ...st.context,
        getValue: (col, row, sheet) => {
          if (!sheet && st.context.evaluateFormula) { const cell = { col, row }; return st.context.evaluateFormula(`=${indexToColumnLetter(col)}${row + 1}`, cell, cell, { changes }); }
          const candidate = !sheet && changes.find(change => change.col === col && change.row === row);
          if (candidate) return candidate.value;
          const item = st.context.items[row], column = st.context.columns[col];
          return st.context.getValue ? st.context.getValue(col, row, sheet) : !sheet && item !== undefined && column ? getCellValue(item, column) : undefined;
        },
        evaluateFormula: st.context.evaluateFormula && ((formula, anchor, cell, proposed) => st.context.evaluateFormula?.(formula, anchor, cell, { ...proposed, changes })),
        resolveSource: st.context.resolveSource && ((source, anchor, cell) => st.context.resolveSource?.(source, anchor, cell, changes)),
      });
      removed = false;
      for (const change of operation.changes) if (change.apply && !decide(change, currentValidator, operation)) removed = true;
    } while (removed && !operation.pending);
  };
  const guard = useCallback((event: ICellValueChangedEvent<T>, apply: () => void, api = false, sheetRow?: number): boolean => {
    const st = latest.current;
    const change = { event, apply, api, row: sheetRow ?? st.sheetRow(event.item, event.rowIndex) };
    if (batch.current && !batch.current.closed) { batch.current.changes.push(change); return true; }
    if (!decide(change, st.validator)) return false;
    apply(); return true;
  }, [latest, decide]);
  const respond = useCallback((accept: boolean) => {
    const pending = queue.current.shift();
    pending?.respond?.(accept);
    setAlert(queue.current[0]?.failure ?? null);
  }, []);
  return { validator, guard, alert, respond, beginBatch, endBatch, afterBatch, previewClears, stage };
}

/** OGrid uses sheet data; stand-alone DataGridTable can use its displayed data. */
export function validationContextFor<T>(context: IDataValidationContext<T> | undefined, items: T[], columns: IDataValidationContext<T>['columns']): IDataValidationContext<T> {
  return context ?? { items, columns, getValue: (col, row) => {
    const item = items[row], column = columns[col];
    return item !== undefined && column ? getCellValue(item, column) : undefined;
  } };
}
