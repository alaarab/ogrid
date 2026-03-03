/**
 * ColorPickerEditor — Premium color swatch picker for OGrid.
 *
 * Usage:
 *   import { ColorPickerEditor } from '@alaarab/ogrid-react-inputs';
 *
 *   const columns = [{
 *     columnId: 'color',
 *     cellEditor: ColorPickerEditor,
 *     cellEditorPopup: true,
 *     cellEditorParams: { allowCustom: true },
 *   }];
 *
 * Implements ICellEditorProps<T> — works with cellEditorPopup: true.
 */
import * as React from 'react';
import type { ICellEditorProps } from '@alaarab/ogrid-core';
import {
  DEFAULT_COLOR_PALETTE,
  isValidHex,
  normalizeHex,
  isLightColor,
} from '@alaarab/ogrid-inputs';

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
  width: '240px',
  userSelect: 'none',
};

const inputRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  marginBottom: '10px',
  alignItems: 'center',
};

const hashPrefixStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--ogrid-muted, #888)',
  lineHeight: 1,
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
  fontFamily: 'monospace',
  textTransform: 'uppercase',
};

const previewStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '4px',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  flexShrink: 0,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: '6px',
  padding: '4px 0',
};

const swatchStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '14px',
  fontWeight: 700,
  padding: 0,
  transition: 'transform 0.1s ease, box-shadow 0.1s ease',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
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

// ── Component ──

export function ColorPickerEditor<T>(props: ICellEditorProps<T>): React.ReactElement {
  const { value, onValueChange, onCommit, onCancel, cellEditorParams } = props;

  const colors = (cellEditorParams as Record<string, unknown> | undefined)?.colors as string[] | undefined ?? DEFAULT_COLOR_PALETTE as unknown as string[];
  const allowCustom = (cellEditorParams as Record<string, unknown> | undefined)?.allowCustom as boolean | undefined ?? true;

  const initialColor = React.useMemo(() => {
    if (value == null || value === '') return '';
    const normalized = normalizeHex(String(value));
    return normalized ?? String(value);
  }, [value]);

  const [selectedColor, setSelectedColor] = React.useState(initialColor);
  const [inputText, setInputText] = React.useState(
    initialColor.replace(/^#/, ''),
  );
  const [hoveredSwatch, setHoveredSwatch] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const handleSwatchClick = (color: string) => {
    const normalized = normalizeHex(color) ?? color;
    setSelectedColor(normalized);
    setInputText(normalized.replace(/^#/, ''));
    onValueChange(normalized);
    // Auto-commit on swatch click
    setTimeout(() => onCommit(), 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
    setInputText(raw);
    const hex = '#' + raw;
    if (isValidHex(hex)) {
      const normalized = normalizeHex(hex);
      if (normalized) {
        setSelectedColor(normalized);
        onValueChange(normalized);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const hex = '#' + inputText;
      if (isValidHex(hex)) {
        const normalized = normalizeHex(hex);
        if (normalized) {
          onValueChange(normalized);
        }
      }
      onCommit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  const handleClear = () => {
    setSelectedColor('');
    setInputText('');
    onValueChange('');
    onCommit();
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

  const renderSwatch = (color: string, index: number) => {
    const normalized = normalizeHex(color) ?? color;
    const isSelected = selectedColor.toUpperCase() === normalized.toUpperCase();
    const isHovered = hoveredSwatch === color;
    const isLight = isLightColor(color);

    const style: React.CSSProperties = {
      ...swatchStyle,
      backgroundColor: color,
      // Light colors get a border so they're visible
      border: isLight
        ? '1px solid var(--ogrid-border, rgba(0,0,0,0.2))'
        : '1px solid transparent',
      transform: isHovered ? 'scale(1.15)' : 'scale(1)',
      boxShadow: isSelected ? '0 0 0 2px var(--ogrid-accent, #0078d4)' : 'none',
      color: isLight ? '#333' : '#fff',
    };

    return (
      <button
        key={`${color}-${index}`}
        type="button"
        style={style}
        onClick={() => handleSwatchClick(color)}
        onMouseEnter={() => setHoveredSwatch(color)}
        onMouseLeave={() => setHoveredSwatch(null)}
        tabIndex={-1}
        aria-label={color}
      >
        {isSelected ? '\u2713' : ''}
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
      style={rootStyle}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Hex input with preview */}
      {allowCustom && (
        <div style={inputRowStyle}>
          <div
            style={{
              ...previewStyle,
              backgroundColor: selectedColor || 'transparent',
            }}
          />
          <span style={hashPrefixStyle}>#</span>
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="000000"
            maxLength={6}
            style={inputStyle}
          />
        </div>
      )}

      {/* Color swatch grid */}
      <div style={gridStyle}>
        {colors.map((color, i) => renderSwatch(color, i))}
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <button type="button" style={footerBtnStyle} onClick={handleClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
