/**
 * SliderEditor  -  Premium range slider cell editor for OGrid.
 *
 * Usage:
 *   import { SliderEditor } from '@alaarab/ogrid-react-inputs';
 *
 *   const columns = [{
 *     columnId: 'progress',
 *     cellEditor: SliderEditor,
 *     cellEditorPopup: true,
 *     cellEditorParams: { min: 0, max: 100, step: 5 },
 *   }];
 *
 * Implements ICellEditorProps<T>  -  works with cellEditorPopup: true.
 */
import * as React from 'react';
import type { ICellEditorProps } from '@alaarab/ogrid-core';
import {
  clampValue,
  snapToStep,
  getPercentage,
  getValueFromOffset,
  DEFAULT_MIN,
  DEFAULT_MAX,
  DEFAULT_STEP,
} from '@alaarab/ogrid-inputs';

// ── Styles (inline to avoid CSS file dependency  -  keeps package sideEffects: false) ──

const rootStyle: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '13px',
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  borderRadius: '8px',
  boxShadow: 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.15))',
  padding: '12px 16px',
  width: '280px',
  userSelect: 'none',
};

const sliderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '8px 0',
};

const trackContainerStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
};

const trackStyle: React.CSSProperties = {
  width: '100%',
  height: '6px',
  borderRadius: '3px',
  background: 'var(--ogrid-border, rgba(0,0,0,0.15))',
  position: 'relative',
  overflow: 'hidden',
};

const trackFillStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  height: '100%',
  borderRadius: '3px',
  background: 'var(--ogrid-accent, #0078d4)',
  transition: 'width 0.05s ease',
};

const thumbStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  background: 'var(--ogrid-accent, #0078d4)',
  border: '2px solid var(--ogrid-bg, #fff)',
  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  transform: 'translate(-50%, -50%)',
  cursor: 'grab',
  transition: 'box-shadow 0.1s ease',
};

const valueLabelStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  minWidth: '40px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const inputRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  marginTop: '8px',
  paddingTop: '8px',
  borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
};

const inputLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--ogrid-muted, #888)',
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
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const rangeInfoStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '11px',
  color: 'var(--ogrid-muted, #888)',
  padding: '2px 0 0',
};

// ── Component ──

export function SliderEditor<T>(props: ICellEditorProps<T>): React.ReactElement {
  const { value, onValueChange, onCommit, onCancel, cellEditorParams } = props;

  const min = (cellEditorParams as Record<string, unknown> | undefined)?.min as number | undefined ?? DEFAULT_MIN;
  const max = (cellEditorParams as Record<string, unknown> | undefined)?.max as number | undefined ?? DEFAULT_MAX;
  const step = (cellEditorParams as Record<string, unknown> | undefined)?.step as number | undefined ?? DEFAULT_STEP;

  const initialValue = React.useMemo(() => {
    if (value == null || value === '') return min;
    const num = Number(value);
    return Number.isNaN(num) ? min : clampValue(snapToStep(num, min, step), min, max);
  }, [value, min, max, step]);

  const [currentValue, setCurrentValue] = React.useState(initialValue);
  const [inputText, setInputText] = React.useState(String(initialValue));
  const [isDragging, setIsDragging] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);

  const percentage = getPercentage(currentValue, min, max);

  const updateValue = React.useCallback(
    (newVal: number) => {
      const clamped = clampValue(snapToStep(newVal, min, step), min, max);
      setCurrentValue(clamped);
      setInputText(String(clamped));
      onValueChange(clamped);
    },
    [min, max, step, onValueChange],
  );

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const newVal = getValueFromOffset(offsetX, rect.width, min, max, step);
    updateValue(newVal);
  };

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // Drag handlers on document
  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const newVal = getValueFromOffset(offsetX, rect.width, min, max, step);
      updateValue(newVal);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Auto-commit on mouse up after drag
      setTimeout(() => onCommit(), 0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, min, max, step, updateValue, onCommit]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);
    const num = Number(text);
    if (!Number.isNaN(num)) {
      const clamped = clampValue(snapToStep(num, min, step), min, max);
      setCurrentValue(clamped);
      onValueChange(clamped);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const num = Number(inputText);
      if (!Number.isNaN(num)) {
        const clamped = clampValue(snapToStep(num, min, step), min, max);
        onValueChange(clamped);
      }
      onCommit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  // Focus input on mount
  React.useEffect(() => {
    const input = rootRef.current?.querySelector('input');
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  // Global escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    const el = rootRef.current;
    if (el) {
      el.addEventListener('keydown', handleKeyDown);
      return () => el.removeEventListener('keydown', handleKeyDown);
    }
  }, [onCancel]);

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: popup editor root; onMouseDown only stops propagation so the grid does not treat clicks as outside-clicks. Keyboard is handled by the value input and a root-level Escape listener.
    // biome-ignore lint/a11y/noStaticElementInteractions: see above — propagation guard, not an interactive control
    <div
      ref={rootRef}
      style={rootStyle}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Slider track + value label */}
      <div style={sliderRowStyle}>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: track click is a pointer-only convenience; keyboard users set the value via the text input below */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: pointer-only jump-to-position affordance duplicating the keyboard-accessible value input */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-only jump-to-position affordance duplicating the keyboard-accessible value input */}
        <div
          ref={trackRef}
          style={trackContainerStyle}
          onClick={handleTrackClick}
        >
          <div style={trackStyle}>
            <div style={{ ...trackFillStyle, width: `${percentage}%` }} />
          </div>
          {/* biome-ignore lint/a11y/useFocusableInteractive: thumb is a pointer-drag affordance; focus and keyboard editing stay on the value input per this editor's keyboard model */}
          <div
            style={{
              ...thumbStyle,
              left: `${percentage}%`,
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            onMouseDown={handleThumbMouseDown}
            role="slider"
            aria-label="Slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={currentValue}
          />
        </div>
        <span style={valueLabelStyle}>{currentValue}</span>
      </div>

      {/* Range info */}
      <div style={rangeInfoStyle}>
        <span>{min}</span>
        <span>{max}</span>
      </div>

      {/* Direct input */}
      <div style={inputRowStyle}>
        <span style={inputLabelStyle}>Value:</span>
        <input
          type="text"
          aria-label={`Value (${min} to ${max})`}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          style={inputStyle}
        />
      </div>
    </div>
  );
}
