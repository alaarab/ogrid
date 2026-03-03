/**
 * DatePickerEditor — Premium calendar-based date picker for OGrid.
 *
 * Usage:
 *   import { DatePickerEditor } from '@alaarab/ogrid-react-inputs';
 *
 *   const columns = [{
 *     columnId: 'dueDate',
 *     cellEditor: DatePickerEditor,
 *     cellEditorPopup: true,
 *   }];
 *
 * Implements ICellEditorProps<T> — works with cellEditorPopup: true.
 */
import * as React from 'react';
import type { ICellEditorProps } from '@alaarab/ogrid-core';
import { getCalendarGrid, formatDate, parseDate, DAY_NAMES, MONTH_NAMES } from './calendar-utils';

// ── Styles (inline to avoid CSS file dependency — keeps package sideEffects: false) ──

const rootStyle: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '13px',
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  borderRadius: '8px',
  boxShadow: 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.15))',
  padding: '12px',
  width: '280px',
  userSelect: 'none',
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

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '8px',
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

// ── Component ──

export function DatePickerEditor<T>(props: ICellEditorProps<T>): React.ReactElement {
  const { value, onValueChange, onCommit, onCancel } = props;

  // Parse initial value
  const initial = React.useMemo(() => {
    if (value == null) return null;
    return parseDate(String(value));
  }, [value]);

  const today = new Date();
  const [viewYear, setViewYear] = React.useState(initial?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(initial?.month ?? today.getMonth());
  const [selectedDate, setSelectedDate] = React.useState(initial ? formatDate(initial.year, initial.month, initial.date) : '');
  const [inputText, setInputText] = React.useState(selectedDate);
  const [hoveredCell, setHoveredCell] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const grid = React.useMemo(() => getCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectDay = (year: number, month: number, date: number) => {
    const formatted = formatDate(year, month, date);
    setSelectedDate(formatted);
    setInputText(formatted);
    onValueChange(formatted);
    // Auto-commit on date selection
    setTimeout(() => onCommit(), 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);
    const parsed = parseDate(text);
    if (parsed) {
      setSelectedDate(formatDate(parsed.year, parsed.month, parsed.date));
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      onValueChange(text);
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

  const handleToday = () => {
    const t = new Date();
    selectDay(t.getFullYear(), t.getMonth(), t.getDate());
  };

  const handleClear = () => {
    setSelectedDate('');
    setInputText('');
    onValueChange('');
    onCommit();
  };

  // Focus the input on mount
  React.useEffect(() => {
    const input = rootRef.current?.querySelector('input');
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  // Keyboard navigation for the calendar
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    const el = rootRef.current;
    if (el) {
      el.addEventListener('keydown', handleGlobalKeyDown);
      return () => el.removeEventListener('keydown', handleGlobalKeyDown);
    }
  }, [onCancel]);

  return (
    <div ref={rootRef} style={rootStyle} onMouseDown={(e) => e.stopPropagation()}>
      {/* Text input for typing dates */}
      <div style={inputRowStyle}>
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder="YYYY-MM-DD"
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
        {/* Day headers */}
        {DAY_NAMES.map((d) => (
          <div key={d} style={dayHeaderStyle}>{d}</div>
        ))}

        {/* Date cells */}
        {grid.flat().map((day) => {
          const key = formatDate(day.year, day.month, day.date);
          const isSelected = key === selectedDate;
          const isHovered = key === hoveredCell;

          const cellStyle: React.CSSProperties = { ...baseCellStyle };

          if (!day.isCurrentMonth) {
            cellStyle.color = 'var(--ogrid-muted, #ccc)';
          }
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
            >
              {day.date}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <button type="button" style={footerBtnStyle} onClick={handleToday}>
          Today
        </button>
        <button type="button" style={footerBtnStyle} onClick={handleClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
