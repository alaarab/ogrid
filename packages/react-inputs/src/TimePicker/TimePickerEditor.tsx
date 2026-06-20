/**
 * TimePickerEditor  -  Premium time picker for OGrid.
 *
 * Usage:
 *   import { TimePickerEditor } from '@alaarab/ogrid-react-inputs';
 *
 *   const columns = [{
 *     columnId: 'meetingTime',
 *     cellEditor: TimePickerEditor,
 *     cellEditorPopup: true,
 *   }];
 *
 * Value format: "h:mm AM/PM" (12-hour US format), e.g. "2:30 PM"
 * Implements ICellEditorProps<T>  -  works with cellEditorPopup: true.
 */
import * as React from 'react';
import type { ICellEditorProps } from '@alaarab/ogrid-core';
import {
  parseTime,
  formatTime12,
  toHour12,
  toAmPm,
  fromHour12,
  getMinuteOptions,
  getHour12Options,
} from './timepicker-utils';
import type { AmPm, TimeValue } from './timepicker-utils';

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
  width: '220px',
  userSelect: 'none',
};

const inputRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  marginBottom: '10px',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '5px 8px',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
  borderRadius: '4px',
  fontSize: '13px',
  outline: 'none',
  background: 'var(--ogrid-bg, #fff)',
  color: 'inherit',
};

const controlsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'stretch',
};

const columnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  gap: '0',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  borderRadius: '6px',
  overflow: 'hidden',
  maxHeight: '176px',
  overflowY: 'auto',
};

const columnLabelStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--ogrid-muted, #888)',
  padding: '4px 0',
  borderBottom: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
  position: 'sticky',
  top: 0,
  background: 'var(--ogrid-bg, #fff)',
};

const baseOptionStyle: React.CSSProperties = {
  padding: '5px 0',
  textAlign: 'center',
  cursor: 'pointer',
  fontSize: '13px',
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

export interface TimePickerEditorParams {
  minuteStep?: number; // default 5
}

export function TimePickerEditor<T>(props: ICellEditorProps<T>): React.ReactElement {
  const { value, onValueChange, onCommit, onCancel } = props;
  const params = (props.cellEditorParams ?? {}) as TimePickerEditorParams;
  const minuteStep = params.minuteStep ?? 5;

  const parseInitial = (): TimeValue => {
    const parsed = parseTime(String(value ?? ''));
    if (parsed) return parsed;
    const now = new Date();
    return { hours: now.getHours(), minutes: Math.floor(now.getMinutes() / minuteStep) * minuteStep };
  };

  const [time, setTime] = React.useState<TimeValue>(parseInitial);
  const [ampm, setAmpm] = React.useState<AmPm>(toAmPm(time.hours));
  const [hour12, setHour12] = React.useState(toHour12(time.hours));
  const [inputText, setInputText] = React.useState(formatTime12(time));
  const rootRef = React.useRef<HTMLDivElement>(null);
  const hourColRef = React.useRef<HTMLDivElement>(null);
  const minuteColRef = React.useRef<HTMLDivElement>(null);

  const hourOptions = getHour12Options();
  const minuteOptions = getMinuteOptions(minuteStep);

  const applyTime = React.useCallback((h12: number, min: number, ap: AmPm) => {
    const h24 = fromHour12(h12, ap);
    const tv: TimeValue = { hours: h24, minutes: min };
    const formatted = formatTime12(tv);
    setInputText(formatted);
    onValueChange(formatted);
  }, [onValueChange]);

  const handleHourSelect = (h: number) => {
    setHour12(h);
    applyTime(h, time.minutes, ampm);
    setTime((prev) => ({ ...prev, hours: fromHour12(h, ampm) }));
  };

  const handleMinuteSelect = (m: number) => {
    setTime((prev) => ({ ...prev, minutes: m }));
    applyTime(hour12, m, ampm);
  };

  const handleAmPm = (ap: AmPm) => {
    setAmpm(ap);
    setTime((prev) => ({ ...prev, hours: fromHour12(hour12, ap) }));
    applyTime(hour12, time.minutes, ap);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);
    const parsed = parseTime(text);
    if (parsed) {
      setTime(parsed);
      setHour12(toHour12(parsed.hours));
      setAmpm(toAmPm(parsed.hours));
      onValueChange(formatTime12(parsed));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onValueChange(inputText);
      onCommit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  const handleNow = () => {
    const now = new Date();
    const h = now.getHours();
    const m = Math.floor(now.getMinutes() / minuteStep) * minuteStep;
    const tv: TimeValue = { hours: h, minutes: m };
    setTime(tv);
    setHour12(toHour12(h));
    setAmpm(toAmPm(h));
    const formatted = formatTime12(tv);
    setInputText(formatted);
    onValueChange(formatted);
    setTimeout(() => onCommit(), 0);
  };

  const handleClear = () => {
    onValueChange('');
    onCommit();
  };

  // Scroll selected items into view on mount
  React.useEffect(() => {
    const scrollSelected = (colEl: HTMLDivElement | null, selectedIndex: number, total: number) => {
      if (!colEl) return;
      // account for sticky header (~25px)
      const itemHeight = (colEl.scrollHeight - 25) / total;
      colEl.scrollTop = selectedIndex * itemHeight;
    };

    const hIdx = hourOptions.indexOf(hour12);
    const mIdx = minuteOptions.indexOf(time.minutes);
    scrollSelected(hourColRef.current, hIdx >= 0 ? hIdx : 0, hourOptions.length);
    scrollSelected(minuteColRef.current, mIdx >= 0 ? mIdx : 0, minuteOptions.length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus input on mount
  React.useEffect(() => {
    const input = rootRef.current?.querySelector('input');
    if (input) { input.focus(); input.select(); }
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
    <div ref={rootRef} style={rootStyle} onMouseDown={(e) => e.stopPropagation()}>
      {/* Text input */}
      <div style={inputRowStyle}>
        <input
          type="text"
          aria-label="Time"
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder="h:mm AM/PM"
          style={inputStyle}
        />
      </div>

      {/* Scrollable columns */}
      <div style={controlsStyle}>
        {/* Hours */}
        <div ref={hourColRef} style={columnStyle}>
          <div style={columnLabelStyle}>Hour</div>
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
        <div style={{ ...columnStyle, flex: 'none', width: '50px' }}>
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
        <button type="button" style={footerBtnStyle} onClick={handleClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
