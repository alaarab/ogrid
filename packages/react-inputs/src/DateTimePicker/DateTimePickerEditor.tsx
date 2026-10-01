/**
 * DateTimePickerEditor  -  Premium date+time picker for OGrid.
 *
 * Usage:
 *   import { DateTimePickerEditor } from '@alaarab/ogrid-react-inputs';
 *
 *   const columns = [{
 *     columnId: 'scheduledAt',
 *     cellEditor: DateTimePickerEditor,
 *     cellEditorPopup: true,
 *   }];
 *
 * Value format: "YYYY-MM-DD h:mm AM/PM" (e.g. "2024-06-01 2:30 PM"), or
 * "YYYY-MM-DD HH:mm" when the stored value is 24-hour.
 * Implements ICellEditorProps<T>  -  works with cellEditorPopup: true.
 */
import * as React from 'react';
import type { ICellEditorProps } from '@alaarab/ogrid-core';
import { getCalendarGrid, formatDate, DAY_NAMES, MONTH_NAMES } from '../DatePicker/calendar-utils';
import {
  toHour12,
  toAmPm,
  fromHour12,
  getMinuteOptions,
  getHour12Options,
} from '../TimePicker/timepicker-utils';
import type { AmPm, TimeValue } from '../TimePicker/timepicker-utils';
import { parseDateTime, formatDateTime } from './datetime-utils';

// ── Styles ──

const rootStyle: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '13px',
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  borderRadius: '8px',
  boxShadow: 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.15))',
  padding: '12px',
  width: '300px',
  userSelect: 'none',
};

const inputRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  marginBottom: '8px',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '4px 8px',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
  borderRadius: '4px',
  fontSize: '13px',
  outline: 'none',
  background: 'var(--ogrid-bg, #fff)',
  color: 'inherit',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '8px',
};

const headerBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '14px',
  color: 'inherit',
  lineHeight: 1,
};

const headerTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '14px',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '1px',
  textAlign: 'center',
};

const dayHeaderStyle: React.CSSProperties = {
  padding: '4px 0',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--ogrid-muted, #888)',
};

const baseCellStyle: React.CSSProperties = {
  padding: '6px 0',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '13px',
  lineHeight: 1,
  border: 'none',
  background: 'none',
  color: 'inherit',
};

const dividerStyle: React.CSSProperties = {
  borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
  margin: '10px 0 8px',
};

const timeSectionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--ogrid-muted, #888)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const timeControlsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  alignItems: 'stretch',
};

const columnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  borderRadius: '6px',
  overflow: 'hidden',
  maxHeight: '130px',
  overflowY: 'auto',
};

const columnLabelStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--ogrid-muted, #888)',
  padding: '3px 0',
  borderBottom: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
  position: 'sticky',
  top: 0,
  background: 'var(--ogrid-bg, #fff)',
};

const baseOptionStyle: React.CSSProperties = {
  padding: '4px 0',
  textAlign: 'center',
  cursor: 'pointer',
  fontSize: '12px',
  border: 'none',
  background: 'none',
  color: 'inherit',
  width: '100%',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '10px',
  paddingTop: '8px',
  borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
};

const footerBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  color: 'var(--ogrid-accent, #0078d4)',
  fontWeight: 500,
};

// ── Component ──

export interface DateTimePickerEditorParams {
  minuteStep?: number; // default 5
}

export function DateTimePickerEditor<T>(props: ICellEditorProps<T>): React.ReactElement {
  const { value, onValueChange, onCommit, onCancel } = props;
  const params = (props.cellEditorParams ?? {}) as DateTimePickerEditorParams;
  const rawStep = params.minuteStep ?? 5;
  // A zero/negative/NaN step would loop forever or produce NaN minutes.
  const minuteStep = Number.isFinite(rawStep) && rawStep >= 1 ? Math.floor(rawStep) : 1;

  const today = new Date();

  // Preserve the stored format: a 24-hour value should not be rewritten as 12-hour.
  const use24Hour = React.useMemo(() => {
    const raw = String(value ?? '').trim();
    return raw !== '' && parseDateTime(value as string | number | Date | null | undefined) !== null && !/am|pm/i.test(raw);
  }, [value]);

  const parseInitial = () => parseDateTime(value as string | number | Date | null | undefined);

  const initial = parseInitial();
  const base = initial ?? {
    year: today.getFullYear(),
    month: today.getMonth(),
    date: today.getDate(),
    hours: today.getHours(),
    minutes: Math.floor(today.getMinutes() / minuteStep) * minuteStep,
  };

  const formatValue = React.useCallback(
    (dt: { year: number; month: number; date: number; hours: number; minutes: number }) =>
      formatDateTime(dt, use24Hour),
    [use24Hour],
  );

  const [viewYear, setViewYear] = React.useState(initial?.year ?? base.year);
  const [viewMonth, setViewMonth] = React.useState(initial?.month ?? base.month);
  const [selectedDate, setSelectedDate] = React.useState(
    initial ? formatDate(initial.year, initial.month, initial.date) : ''
  );
  const [selectedYear, setSelectedYear] = React.useState<number | null>(initial?.year ?? null);
  const [selectedMonth, setSelectedMonth] = React.useState<number | null>(initial?.month ?? null);
  const [selectedDay, setSelectedDay] = React.useState<number | null>(initial?.date ?? null);
  const [time, setTime] = React.useState<TimeValue>({ hours: base.hours, minutes: base.minutes });
  const [ampm, setAmpm] = React.useState<AmPm>(toAmPm(base.hours));
  const [hour12, setHour12] = React.useState(toHour12(base.hours));
  const [inputText, setInputText] = React.useState(() => {
    if (initial) return formatDateTime(initial, use24Hour);
    return value == null || String(value).trim() === '' ? '' : String(value);
  });
  const [hoveredCell, setHoveredCell] = React.useState<string | null>(null);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const hourColRef = React.useRef<HTMLDivElement>(null);
  const minuteColRef = React.useRef<HTMLDivElement>(null);
  const commitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const grid = React.useMemo(() => getCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const hourOptions = getHour12Options();
  const minuteOptions = getMinuteOptions(minuteStep);

  const buildAndEmit = React.useCallback(
    (year: number | null, month: number | null, date: number | null, hours: number, minutes: number) => {
      // Without a chosen date we must not fabricate one (that would overwrite
      // an unparseable stored value with today).
      if (year == null || month == null || date == null) return;
      const formatted = formatValue({ year, month, date, hours, minutes });
      setInputText(formatted);
      onValueChange(formatted);
    },
    [formatValue, onValueChange]
  );

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else { setViewMonth((m) => m - 1); }
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else { setViewMonth((m) => m + 1); }
  };

  const selectDay = (year: number, month: number, date: number) => {
    const key = formatDate(year, month, date);
    setSelectedDate(key);
    setSelectedYear(year);
    setSelectedMonth(month);
    setSelectedDay(date);
    buildAndEmit(year, month, date, time.hours, time.minutes);
  };

  const handleHourSelect = (h: number) => {
    setHour12(h);
    const h24 = fromHour12(h, ampm);
    setTime((prev) => ({ ...prev, hours: h24 }));
    buildAndEmit(selectedYear, selectedMonth, selectedDay, h24, time.minutes);
  };

  const handleMinuteSelect = (m: number) => {
    setTime((prev) => ({ ...prev, minutes: m }));
    buildAndEmit(selectedYear, selectedMonth, selectedDay, time.hours, m);
  };

  const handleAmPm = (ap: AmPm) => {
    setAmpm(ap);
    const h24 = fromHour12(hour12, ap);
    setTime((prev) => ({ ...prev, hours: h24 }));
    buildAndEmit(selectedYear, selectedMonth, selectedDay, h24, time.minutes);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);
    const parsed = parseDateTime(text);
    if (!parsed) return;
    setViewYear(parsed.year);
    setViewMonth(parsed.month);
    setSelectedDate(formatDate(parsed.year, parsed.month, parsed.date));
    setSelectedYear(parsed.year);
    setSelectedMonth(parsed.month);
    setSelectedDay(parsed.date);
    setTime({ hours: parsed.hours, minutes: parsed.minutes });
    setHour12(toHour12(parsed.hours));
    setAmpm(toAmPm(parsed.hours));
    // Emit so Apply (or a later commit) picks up a valid typed value.
    onValueChange(formatValue(parsed));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Only commit parseable text; refuse raw garbage.
      const parsed = parseDateTime(inputText);
      if (!parsed) return;
      onValueChange(formatValue(parsed));
      onCommit();
    }
  };

  const handleNow = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();
    const hours = now.getHours();
    const minutes = Math.floor(now.getMinutes() / minuteStep) * minuteStep;

    setViewYear(year);
    setViewMonth(month);
    setSelectedDate(formatDate(year, month, date));
    setSelectedYear(year);
    setSelectedMonth(month);
    setSelectedDay(date);
    setTime({ hours, minutes });
    setHour12(toHour12(hours));
    setAmpm(toAmPm(hours));
    buildAndEmit(year, month, date, hours, minutes);
    commitTimerRef.current = setTimeout(() => onCommit(), 0);
  };

  const handleClear = () => {
    setSelectedDate('');
    setSelectedYear(null);
    setSelectedMonth(null);
    setSelectedDay(null);
    setInputText('');
    onValueChange('');
    onCommit();
  };

  // Scroll selected items into view on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only effect; deliberately reads initial hour12/time/options once to avoid re-scrolling while the user interacts
  React.useEffect(() => {
    const scrollSelected = (colEl: HTMLDivElement | null, selectedIndex: number, total: number) => {
      if (!colEl) return;
      const itemHeight = (colEl.scrollHeight - 22) / total;
      colEl.scrollTop = selectedIndex * itemHeight;
    };
    const hIdx = hourOptions.indexOf(hour12);
    const mIdx = minuteOptions.indexOf(time.minutes);
    scrollSelected(hourColRef.current, hIdx >= 0 ? hIdx : 0, hourOptions.length);
    scrollSelected(minuteColRef.current, mIdx >= 0 ? mIdx : 0, minuteOptions.length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the input on mount so the editor is keyboard-operable.
  React.useEffect(() => {
    const input = rootRef.current?.querySelector('input');
    if (input) { input.focus(); input.select(); }
  }, []);

  // Cancel any pending auto-commit on unmount.
  React.useEffect(() => () => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
  }, []);

  // Escape key
  React.useEffect(() => {
    const el = rootRef.current;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };
    if (el) { el.addEventListener('keydown', handler); return () => el.removeEventListener('keydown', handler); }
  }, [onCancel]);

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: popup editor root; onMouseDown only stops propagation so the grid does not treat clicks as outside-clicks. Keyboard is handled by the inner input and a root-level Escape listener.
    // biome-ignore lint/a11y/noStaticElementInteractions: see above — propagation guard, not an interactive control
    <div ref={rootRef} style={rootStyle} onMouseDown={(e) => e.stopPropagation()}>
      {/* Text input for typing dates/times */}
      <div style={inputRowStyle}>
        <input
          type="text"
          aria-label="Date and time"
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder="YYYY-MM-DD h:mm AM"
          style={inputStyle}
        />
      </div>

      {/* Month/year header */}
      <div style={headerStyle}>
        <button type="button" style={headerBtnStyle} onClick={prevMonth} aria-label="Previous month">
          &#8249;
        </button>
        <span style={headerTitleStyle}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button type="button" style={headerBtnStyle} onClick={nextMonth} aria-label="Next month">
          &#8250;
        </button>
      </div>

      {/* Calendar grid */}
      <div style={gridStyle}>
        {DAY_NAMES.map((d) => (
          <div key={d} style={dayHeaderStyle}>{d}</div>
        ))}
        {grid.flat().map((day) => {
          const key = formatDate(day.year, day.month, day.date);
          const isSelected = key === selectedDate;
          const isHovered = key === hoveredCell;
          const cellStyle: React.CSSProperties = { ...baseCellStyle };
          if (!day.isCurrentMonth) cellStyle.color = 'var(--ogrid-muted, #ccc)';
          if (day.isToday && !isSelected) {
            cellStyle.fontWeight = 700;
            cellStyle.color = 'var(--ogrid-accent, #0078d4)';
          }
          if (isSelected) {
            cellStyle.background = 'var(--ogrid-accent, #0078d4)';
            cellStyle.color = '#fff';
            cellStyle.fontWeight = 600;
          } else if (isHovered) {
            cellStyle.background = 'var(--ogrid-bg-hover, #f0f0f0)';
          }
          return (
            <button
              key={key}
              type="button"
              style={cellStyle}
              onClick={() => selectDay(day.year, day.month, day.date)}
              onMouseEnter={() => setHoveredCell(key)}
              onMouseLeave={() => setHoveredCell(null)}
              tabIndex={-1}
              aria-label={`${MONTH_NAMES[day.month]} ${day.date}, ${day.year}`}
              aria-pressed={isSelected}
            >
              {day.date}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div style={dividerStyle} />

      {/* Time section */}
      <div style={timeSectionLabelStyle}>Time</div>
      <div style={timeControlsStyle}>
        {/* Hours */}
        <div ref={hourColRef} style={columnStyle}>
          <div style={columnLabelStyle}>Hr</div>
          {hourOptions.map((h) => {
            const isSelected = h === hour12;
            const style: React.CSSProperties = {
              ...baseOptionStyle,
              background: isSelected ? 'var(--ogrid-accent, #0078d4)' : 'none',
              color: isSelected ? '#fff' : 'inherit',
              fontWeight: isSelected ? 600 : 400,
            };
            return (
              <button key={h} type="button" style={style} onClick={() => handleHourSelect(h)} tabIndex={-1}>
                {h}
              </button>
            );
          })}
        </div>

        {/* Minutes */}
        <div ref={minuteColRef} style={columnStyle}>
          <div style={columnLabelStyle}>Min</div>
          {minuteOptions.map((m) => {
            const isSelected = m === time.minutes;
            const style: React.CSSProperties = {
              ...baseOptionStyle,
              background: isSelected ? 'var(--ogrid-accent, #0078d4)' : 'none',
              color: isSelected ? '#fff' : 'inherit',
              fontWeight: isSelected ? 600 : 400,
            };
            return (
              <button key={m} type="button" style={style} onClick={() => handleMinuteSelect(m)} tabIndex={-1}>
                {String(m).padStart(2, '0')}
              </button>
            );
          })}
        </div>

        {/* AM/PM */}
        <div style={{ ...columnStyle, flex: 'none', width: '46px' }}>
          <div style={columnLabelStyle}>AM/PM</div>
          {(['AM', 'PM'] as AmPm[]).map((ap) => {
            const isSelected = ap === ampm;
            const style: React.CSSProperties = {
              ...baseOptionStyle,
              background: isSelected ? 'var(--ogrid-accent, #0078d4)' : 'none',
              color: isSelected ? '#fff' : 'inherit',
              fontWeight: isSelected ? 600 : 400,
            };
            return (
              <button key={ap} type="button" style={style} onClick={() => handleAmPm(ap)} tabIndex={-1}>
                {ap}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <button type="button" style={footerBtnStyle} onClick={handleNow}>
          Now
        </button>
        <button type="button" style={footerBtnStyle} onClick={() => onCommit()}>
          Apply
        </button>
        <button type="button" style={footerBtnStyle} onClick={handleClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
