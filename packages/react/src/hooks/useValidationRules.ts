import { useCallback, useState } from 'react';
import type { IDataValidationRule } from '@alaarab/ogrid-core';
import { useLatestRef } from './useLatestRef';
const EMPTY: never[] = [];
/** Local editing also works with a read-only initial rules prop; callbacks can persist it. */
export function useValidationRules<T>(rules: IDataValidationRule<T>[] | undefined, onChange?: (rules: IDataValidationRule<T>[]) => void) {
  const [state, setState] = useState({ input: rules, rules: rules ?? EMPTY });
  if (state.input !== rules) setState({ input: rules, rules: rules ?? EMPTY });
  const latest = useLatestRef({ rules, onChange });
  const change = useCallback((next: IDataValidationRule<T>[]) => {
    setState({ input: latest.current.rules, rules: next });
    latest.current.onChange?.(next);
  }, [latest]);
  return { rules: state.input === rules ? state.rules : rules ?? EMPTY, change };
}
