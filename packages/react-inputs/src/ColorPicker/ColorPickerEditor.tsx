/**
 * ColorPickerEditor  -  Premium color swatch picker for OGrid.
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
 * Implements ICellEditorProps<T>  -  works with cellEditorPopup: true.
 */
import * as React from 'react';
import { nextGridIndex } from '../shared/keyboard-nav';
import type { ICellEditorProps } from '@alaarab/ogrid-core';
import {
  DEFAULT_COLOR_PALETTE,
  isValidHex,
  normalizeHex,
  isLightColor,
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

const SWATCH_COLUMNS = 5;

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `repeat(${SWATCH_COLUMNS}, 1fr)`,
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
  justifyContent: 'flex-start',
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
  const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const swatchGridRef = React.useRef<HTMLDivElement>(null);
  const commitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSwatchClick = (color: string) => {
    const normalized = normalizeHex(color) ?? color;
    setSelectedColor(normalized);
    setInputText(normalized.replace(/^#/, ''));
    onValueChange(normalized);
    // Auto-commit on swatch click
    commitTimerRef.current = setTimeout(() => onCommit(), 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 8);
    setInputText(raw);
    // Only emit a value once the hex is complete (6 = RRGGBB, 8 = RRGGBBAA).
    // Emitting partial prefixes is what committed stale intermediate values.
    if (raw.length !== 6 && raw.length !== 8) return;
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
      // Commit only a complete 3-, 6- or 8-digit hex; refuse anything else.
      const complete = inputText.length === 3 || inputText.length === 6 || inputText.length === 8;
      const hex = '#' + inputText;
      if (!complete || !isValidHex(hex)) return;
      const normalized = normalizeHex(hex);
      if (!normalized) return;
      setSelectedColor(normalized);
      setInputText(normalized.replace(/^#/, ''));
      onValueChange(normalized);
      onCommit();
    }
  };

  const handleClear = () => {
    setSelectedColor('');
    setInputText('');
    onValueChange('');
    onCommit();
  };

  // Roving tabindex over the swatches: one swatch (the focused, selected or
  // first one) is in the tab order; arrows/Home/End move, Enter/Space pick.
  const selectedIndex = colors.findIndex(
    (c) => (normalizeHex(c) ?? c).toUpperCase() === selectedColor.toUpperCase(),
  );
  const tabbableIndex = focusedIndex ?? (selectedIndex >= 0 ? selectedIndex : 0);

  const focusSwatch = (index: number) => {
    swatchGridRef.current?.querySelectorAll<HTMLButtonElement>('button')[index]?.focus();
  };

  const handleSwatchKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number, color: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      handleSwatchClick(color);
      return;
    }
    const next = nextGridIndex(index, e.key, colors.length, SWATCH_COLUMNS);
    if (next == null) return;
    e.preventDefault();
    e.stopPropagation();
    setFocusedIndex(next);
    focusSwatch(next);
  };

  // Focus the hex input on mount, or the swatches when there is no input.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only focus
  React.useEffect(() => {
    const input = rootRef.current?.querySelector('input');
    if (input) {
      input.focus();
      input.select();
    } else {
      focusSwatch(tabbableIndex);
    }
  }, []);

  // Cancel any pending auto-commit on unmount.
  React.useEffect(() => () => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
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
        onKeyDown={(e) => handleSwatchKeyDown(e, index, color)}
        onFocus={() => setFocusedIndex(index)}
        tabIndex={index === tabbableIndex ? 0 : -1}
        aria-label={color}
        aria-pressed={isSelected}
      >
        {isSelected ? '\u2713' : ''}
      </button>
    );
  };

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: popup editor root; onMouseDown only stops propagation so the grid does not treat clicks as outside-clicks. Keyboard is handled by the inner controls and a root-level Escape listener.
    // biome-ignore lint/a11y/noStaticElementInteractions: see above — propagation guard, not an interactive control
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
            aria-label="Hex color"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="000000"
            maxLength={8}
            style={inputStyle}
          />
        </div>
      )}

      {/* Color swatch grid */}
      <div ref={swatchGridRef} style={gridStyle}>
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
