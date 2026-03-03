/**
 * RatingEditor  -  Premium star-rating cell editor for OGrid.
 *
 * Usage:
 *   import { RatingEditor } from '@alaarab/ogrid-react-inputs';
 *
 *   const columns = [{
 *     columnId: 'priority',
 *     cellEditor: RatingEditor,
 *     cellEditorPopup: true,
 *     cellEditorParams: { maxStars: 5, allowHalf: false },
 *   }];
 *
 * Implements ICellEditorProps<T>  -  works with cellEditorPopup: true.
 */
import * as React from 'react';
import type { ICellEditorProps } from '@alaarab/ogrid-core';
import {
  clampRating,
  getStarFill,
  getRatingFromPosition,
  DEFAULT_MAX_STARS,
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
  userSelect: 'none',
};

const starsRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  padding: '8px 0',
};

const starBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px',
  fontSize: '28px',
  lineHeight: 1,
  transition: 'transform 0.1s ease',
  color: 'inherit',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--ogrid-muted, #888)',
  padding: '4px 0 0',
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

export function RatingEditor<T>(props: ICellEditorProps<T>): React.ReactElement {
  const { value, onValueChange, onCommit, onCancel, cellEditorParams } = props;

  const maxStars = (cellEditorParams as Record<string, unknown> | undefined)?.maxStars as number | undefined ?? DEFAULT_MAX_STARS;
  const allowHalf = (cellEditorParams as Record<string, unknown> | undefined)?.allowHalf as boolean | undefined ?? false;

  const initialRating = React.useMemo(() => {
    if (value == null || value === '') return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : clampRating(num, maxStars);
  }, [value, maxStars]);

  const [rating, setRating] = React.useState(initialRating);
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const displayRating = hoverRating ?? rating;

  const handleStarClick = (starIndex: number, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const starWidth = rect.width;
    const newRating = getRatingFromPosition(starIndex, offsetX, starWidth, allowHalf);
    const clamped = clampRating(newRating, maxStars);
    setRating(clamped);
    onValueChange(clamped);
    // Auto-commit on click
    setTimeout(() => onCommit(), 0);
  };

  const handleStarHover = (starIndex: number, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const starWidth = rect.width;
    const hoverVal = getRatingFromPosition(starIndex, offsetX, starWidth, allowHalf);
    setHoverRating(clampRating(hoverVal, maxStars));
  };

  const handleMouseLeave = () => {
    setHoverRating(null);
  };

  const handleClear = () => {
    setRating(0);
    onValueChange('');
    onCommit();
  };

  // Focus root on mount
  React.useEffect(() => {
    rootRef.current?.focus();
  }, []);

  // Keyboard handling
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onCommit();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = allowHalf ? 0.5 : 1;
        setRating((prev) => {
          const next = clampRating(prev + step, maxStars);
          onValueChange(next);
          return next;
        });
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = allowHalf ? 0.5 : 1;
        setRating((prev) => {
          const next = clampRating(Math.max(0, prev - step), maxStars);
          onValueChange(next || '');
          return next;
        });
      }
    };
    const el = rootRef.current;
    if (el) {
      el.addEventListener('keydown', handleKeyDown);
      return () => el.removeEventListener('keydown', handleKeyDown);
    }
  }, [onCancel, onCommit, onValueChange, maxStars, allowHalf]);

  const renderStar = (starIndex: number) => {
    const fill = getStarFill(starIndex, displayRating, allowHalf);

    let starChar: string;
    let starColor: string;
    if (fill === 'full') {
      starChar = '\u2605'; // ★
      starColor = '#F59E0B';
    } else if (fill === 'half') {
      starChar = '\u2605'; // ★ with clip
      starColor = '#F59E0B';
    } else {
      starChar = '\u2606'; // ☆
      starColor = 'var(--ogrid-muted, #ccc)';
    }

    const style: React.CSSProperties = {
      ...starBtnStyle,
      color: starColor,
    };

    if (fill === 'half') {
      // Use a gradient mask to show half-filled star
      return (
        <button
          key={starIndex}
          type="button"
          style={style}
          onClick={(e) => handleStarClick(starIndex, e)}
          onMouseMove={(e) => handleStarHover(starIndex, e)}
          tabIndex={-1}
        >
          <span
            style={{
              background: `linear-gradient(90deg, #F59E0B 50%, var(--ogrid-muted, #ccc) 50%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {'\u2605'}
          </span>
        </button>
      );
    }

    return (
      <button
        key={starIndex}
        type="button"
        style={style}
        onClick={(e) => handleStarClick(starIndex, e)}
        onMouseMove={(e) => handleStarHover(starIndex, e)}
        tabIndex={-1}
      >
        {starChar}
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
      style={rootStyle}
      onMouseDown={(e) => e.stopPropagation()}
      tabIndex={0}
    >
      {/* Stars row */}
      <div style={starsRowStyle} onMouseLeave={handleMouseLeave}>
        {Array.from({ length: maxStars }, (_, i) => renderStar(i))}
      </div>

      {/* Rating label */}
      <div style={labelStyle}>
        {rating > 0 ? `${rating} / ${maxStars}` : 'No rating'}
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
