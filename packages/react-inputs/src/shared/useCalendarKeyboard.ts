import * as React from 'react';
import { formatDate, parseDate } from '@alaarab/ogrid-inputs';
import type { CalendarDay } from '@alaarab/ogrid-inputs';
import { nextCalendarDate } from './keyboard-nav';

export interface UseCalendarKeyboardParams {
  viewYear: number;
  viewMonth: number;
  /** Move the visible month (keyboard navigation can cross month boundaries). */
  setView: (year: number, month: number) => void;
  /** Selected date as YYYY-MM-DD, or '' for none. */
  selectedDate: string;
  onSelect: (year: number, month: number, date: number) => void;
}

export interface CalendarDayKeyboardProps {
  tabIndex: number;
  'data-date': string;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

/**
 * Roving-tabindex keyboard support for a calendar day grid: one day is in the
 * tab order (the focused, selected, today's or first day of the visible
 * month); arrows/Home/End/PageUp/PageDown move focus, Enter/Space select.
 */
export function useCalendarKeyboard(params: UseCalendarKeyboardParams): {
  gridRef: React.RefObject<HTMLDivElement | null>;
  getDayProps: (day: CalendarDay) => CalendarDayKeyboardProps;
} {
  const { viewYear, viewMonth, setView, selectedDate, onSelect } = params;
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [focusedDate, setFocusedDate] = React.useState<string>('');
  const pendingFocusRef = React.useRef<string | null>(null);

  const inView = (key: string): boolean => {
    const p = key ? parseDate(key) : null;
    return !!p && p.year === viewYear && p.month === viewMonth;
  };

  const today = new Date();
  const todayKey = formatDate(today.getFullYear(), today.getMonth(), today.getDate());
  const tabbableKey = inView(focusedDate)
    ? focusedDate
    : inView(selectedDate)
      ? selectedDate
      : inView(todayKey)
        ? todayKey
        : formatDate(viewYear, viewMonth, 1);

  React.useEffect(() => {
    const key = pendingFocusRef.current;
    if (!key) return;
    pendingFocusRef.current = null;
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${key}"]`);
    btn?.focus();
  });

  const getDayProps = (day: CalendarDay): CalendarDayKeyboardProps => {
    const key = formatDate(day.year, day.month, day.date);
    return {
      tabIndex: key === tabbableKey ? 0 : -1,
      'data-date': key,
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onSelect(day.year, day.month, day.date);
          return;
        }
        const next = nextCalendarDate({ year: day.year, month: day.month, date: day.date }, e.key, e.shiftKey);
        if (!next) return;
        e.preventDefault();
        e.stopPropagation();
        const nextKey = formatDate(next.year, next.month, next.date);
        setFocusedDate(nextKey);
        if (next.year !== viewYear || next.month !== viewMonth) setView(next.year, next.month);
        pendingFocusRef.current = nextKey;
      },
    };
  };

  return { gridRef, getDayProps };
}
