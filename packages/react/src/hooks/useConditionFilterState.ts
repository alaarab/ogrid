/**
 * Condition filter state sub-hook for column header filters (`number` / `condition`
 * filter types): two pending conditions and their AND/OR join, applied together.
 */

import { useState, useCallback, useEffect } from 'react';
import { CONDITION_OPERATORS } from '@alaarab/ogrid-core';
import type { ConditionFilterKind, ConditionOperator, IConditionFilterValue, IFilterCondition } from '@alaarab/ogrid-core';

/** One condition as edited in the popover (operands as input strings; `''` operator = unused). */
export interface ConditionDraft {
  operator: ConditionOperator | '';
  value: string;
  valueTo: string;
}

export interface UseConditionFilterStateParams {
  conditionKind?: ConditionFilterKind;
  conditionValue?: IConditionFilterValue;
  onConditionChange?: (value: IConditionFilterValue | undefined) => void;
  isFilterOpen: boolean;
}

export interface UseConditionFilterStateResult {
  conditionKind: ConditionFilterKind;
  /** Always two drafts: the second is optional (`operator: ''`). */
  conditionDrafts: [ConditionDraft, ConditionDraft];
  setConditionDraft: (index: 0 | 1, patch: Partial<ConditionDraft>) => void;
  conditionJoin: 'and' | 'or';
  setConditionJoin: (join: 'and' | 'or') => void;
  handleConditionApply: () => void;
  handleConditionClear: () => void;
}

function toDraft(condition: IFilterCondition | undefined, fallback: ConditionOperator | ''): ConditionDraft {
  return {
    operator: condition?.operator ?? fallback,
    value: condition?.value != null ? String(condition.value) : '',
    valueTo: condition?.valueTo != null ? String(condition.valueTo) : '',
  };
}

function draftsFrom(kind: ConditionFilterKind, value: IConditionFilterValue | undefined): [ConditionDraft, ConditionDraft] {
  const first = CONDITION_OPERATORS[kind][0] ?? 'equals';
  return [toDraft(value?.conditions[0], first), toDraft(value?.conditions[1], '')];
}

function fromDraft(kind: ConditionFilterKind, draft: ConditionDraft): IFilterCondition | null {
  if (!draft.operator) return null;
  const parse = (text: string): string | number | undefined => {
    const trimmed = text.trim();
    if (trimmed === '') return undefined;
    if (kind === 'number' || draft.operator === 'top' || draft.operator === 'bottom') {
      const n = Number(trimmed.replace(/,/g, ''));
      return Number.isFinite(n) ? n : trimmed;
    }
    return kind === 'text' ? text : trimmed;
  };
  const condition: IFilterCondition = { operator: draft.operator };
  const value = parse(draft.value);
  if (value !== undefined) condition.value = value;
  if (draft.operator === 'between') {
    const valueTo = parse(draft.valueTo);
    if (valueTo !== undefined) condition.valueTo = valueTo;
  }
  return condition;
}

export function useConditionFilterState(params: UseConditionFilterStateParams): UseConditionFilterStateResult {
  const { conditionKind = 'number', conditionValue, onConditionChange, isFilterOpen } = params;

  const [conditionDrafts, setConditionDrafts] = useState<[ConditionDraft, ConditionDraft]>(() =>
    draftsFrom(conditionKind, conditionValue),
  );
  const [conditionJoin, setConditionJoin] = useState<'and' | 'or'>(conditionValue?.join ?? 'and');

  // Sync the drafts with the applied filter when the popover opens.
  useEffect(() => {
    if (isFilterOpen) {
      setConditionDrafts(draftsFrom(conditionKind, conditionValue));
      setConditionJoin(conditionValue?.join ?? 'and');
    }
  }, [isFilterOpen, conditionKind, conditionValue]);

  const setConditionDraft = useCallback((index: 0 | 1, patch: Partial<ConditionDraft>) => {
    setConditionDrafts((prev) => {
      const next: [ConditionDraft, ConditionDraft] = [prev[0], prev[1]];
      next[index] = { ...prev[index], ...patch };
      return next;
    });
  }, []);

  const handleConditionApply = useCallback(() => {
    const conditions = conditionDrafts
      .map((draft) => fromDraft(conditionKind, draft))
      .filter((c): c is IFilterCondition => c !== null);
    // The grid drops incomplete conditions; nothing left clears the filter.
    onConditionChange?.(
      conditions.length > 0
        ? { kind: conditionKind, conditions, ...(conditions.length > 1 ? { join: conditionJoin } : {}) }
        : undefined,
    );
  }, [conditionDrafts, conditionKind, conditionJoin, onConditionChange]);

  const handleConditionClear = useCallback(() => {
    setConditionDrafts(draftsFrom(conditionKind, undefined));
    setConditionJoin('and');
    onConditionChange?.(undefined);
  }, [conditionKind, onConditionChange]);

  return {
    conditionKind,
    conditionDrafts,
    setConditionDraft,
    conditionJoin,
    setConditionJoin,
    handleConditionApply,
    handleConditionClear,
  };
}
