import { useCallback, useState } from 'react';

export interface UseOGridQuickFilterParams {
  /** Controlled text (`quickFilter` prop). */
  controlled?: string;
  /** Starting text when uncontrolled (`defaultQuickFilter`). */
  defaultValue?: string;
  onChange?: (text: string) => void;
  setPage: (page: number) => void;
}

/** Quick filter text, controlled or uncontrolled. A change goes back to page 1, like column filters. */
export function useOGridQuickFilter(params: UseOGridQuickFilterParams): { quickFilter: string; setQuickFilter: (text: string) => void } {
  const { controlled, defaultValue, onChange, setPage } = params;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const quickFilter = controlled ?? internal;
  const isControlled = controlled !== undefined;
  const setQuickFilter = useCallback(
    (text: string) => {
      if (!isControlled) setInternal(text);
      onChange?.(text);
      setPage(1);
    },
    [isControlled, onChange, setPage],
  );
  return { quickFilter, setQuickFilter };
}
