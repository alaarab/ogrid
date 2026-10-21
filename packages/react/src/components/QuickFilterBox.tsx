/**
 * Toolbar search box for the grid's quick filter (`quickFilterBox`). Typing
 * filters after a short pause so large grids don't re-filter on every key;
 * Enter applies at once and Escape clears.
 */
import * as React from 'react';

export interface QuickFilterBoxProps {
  /** Current quick filter text. */
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  /** Accessible name. Default: "Search all columns". */
  ariaLabel?: string;
  /** Delay before typing applies, in ms. Default: 200. */
  debounceMs?: number;
}

const BOX_STYLE: React.CSSProperties = {
  boxSizing: 'border-box',
  width: 220,
  maxWidth: '100%',
  padding: '3px 8px',
  font: 'inherit',
  fontSize: 13,
  lineHeight: '20px',
  border: '1px solid var(--ogrid-border, #e0e0e0)',
  borderRadius: 4,
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
};

export function QuickFilterBox({
  value, onChange, placeholder = 'Search', ariaLabel = 'Search all columns', debounceMs = 200,
}: QuickFilterBoxProps): React.ReactElement {
  const [draft, setDraft] = React.useState(value);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  // The last text this box sent. When `value` comes back as that text it is our
  // own echo; anything else was set from outside (controlled prop, cleared filters).
  const sentRef = React.useRef(value);

  const cancel = () => {
    if (timerRef.current != null) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  // An outside value replaces the draft and drops a pending apply, so an old
  // keystroke can't overwrite it. Layout effect: before any timer can fire.
  React.useLayoutEffect(() => {
    if (value === sentRef.current) return;
    sentRef.current = value;
    if (timerRef.current != null) clearTimeout(timerRef.current);
    timerRef.current = null;
    setDraft(value);
  }, [value]);

  // Drop a pending apply on unmount.
  React.useEffect(() => () => {
    if (timerRef.current != null) clearTimeout(timerRef.current);
  }, []);

  const apply = (text: string) => {
    cancel();
    if (text === sentRef.current) return;
    sentRef.current = text;
    onChangeRef.current(text);
  };

  return (
    <input
      type="search"
      data-ogrid-quick-filter=""
      style={BOX_STYLE}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={draft}
      spellCheck={false}
      autoComplete="off"
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        cancel();
        timerRef.current = setTimeout(() => apply(text), debounceMs);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          apply(draft);
        } else if (e.key === 'Escape' && draft !== '') {
          // Clear the search; a second Escape (empty box) is left to the page.
          e.stopPropagation();
          setDraft('');
          apply('');
        }
      }}
    />
  );
}
