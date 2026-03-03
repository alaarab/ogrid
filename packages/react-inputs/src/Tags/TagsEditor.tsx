/**
 * TagsEditor — Premium multi-value tag/chip cell editor for OGrid.
 *
 * Usage:
 *   import { TagsEditor } from '@alaarab/ogrid-react-inputs';
 *
 *   const columns = [{
 *     columnId: 'labels',
 *     cellEditor: TagsEditor,
 *     cellEditorPopup: true,
 *     cellEditorParams: { suggestions: ['Bug', 'Feature', 'Docs'], allowCreate: true },
 *   }];
 *
 * Implements ICellEditorProps<T> — works with cellEditorPopup: true.
 * Tags are stored as a comma-separated string.
 */
import * as React from 'react';
import type { ICellEditorProps } from '@alaarab/ogrid-core';
import {
  parseTags,
  formatTags,
  getTagColor,
  filterTagSuggestions,
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
  width: '280px',
  userSelect: 'none',
};

const tagsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  minHeight: '32px',
  padding: '4px 0',
};

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '3px 8px',
  borderRadius: '12px',
  fontSize: '12px',
  fontWeight: 500,
  lineHeight: 1.4,
  maxWidth: '200px',
  overflow: 'hidden',
};

const chipTextStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const chipRemoveBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0 2px',
  fontSize: '14px',
  lineHeight: 1,
  color: 'inherit',
  opacity: 0.6,
  flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
  borderRadius: '4px',
  fontSize: '13px',
  outline: 'none',
  background: 'var(--ogrid-bg, #fff)',
  color: 'inherit',
  marginTop: '6px',
};

const suggestionsStyle: React.CSSProperties = {
  maxHeight: '120px',
  overflowY: 'auto',
  marginTop: '4px',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.1))',
  borderRadius: '4px',
  background: 'var(--ogrid-bg, #fff)',
};

const suggestionItemStyle: React.CSSProperties = {
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '12px',
  borderBottom: '1px solid var(--ogrid-border, rgba(0,0,0,0.04))',
};

const suggestionItemHoveredStyle: React.CSSProperties = {
  background: 'var(--ogrid-bg-hover, #f0f0f0)',
};

const emptyLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--ogrid-muted, #888)',
  fontStyle: 'italic',
  padding: '4px 0',
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

const tagCountStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--ogrid-muted, #888)',
};

// ── Component ──

export function TagsEditor<T>(props: ICellEditorProps<T>): React.ReactElement {
  const { value, onValueChange, onCommit, onCancel, cellEditorParams } = props;

  const suggestions = (cellEditorParams as Record<string, unknown> | undefined)?.suggestions as string[] | undefined;
  const allowCreate = (cellEditorParams as Record<string, unknown> | undefined)?.allowCreate as boolean | undefined ?? true;

  const [tags, setTags] = React.useState<string[]>(() => parseTags(value));
  const [inputText, setInputText] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filteredSuggestions = React.useMemo(() => {
    if (!suggestions) return [];
    return filterTagSuggestions(inputText, suggestions, tags);
  }, [inputText, suggestions, tags]);

  const showSuggestions = filteredSuggestions.length > 0 && inputText.length > 0;

  const updateTags = React.useCallback(
    (newTags: string[]) => {
      setTags(newTags);
      onValueChange(formatTags(newTags));
    },
    [onValueChange],
  );

  const addTag = React.useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed) return;
      if (tags.includes(trimmed)) return;
      if (!allowCreate && suggestions && !suggestions.includes(trimmed)) return;
      const newTags = [...tags, trimmed];
      updateTags(newTags);
      setInputText('');
      setHighlightedIndex(-1);
    },
    [tags, allowCreate, suggestions, updateTags],
  );

  const removeTag = React.useCallback(
    (index: number) => {
      const newTags = tags.filter((_, i) => i !== index);
      updateTags(newTags);
    },
    [tags, updateTags],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    setHighlightedIndex(-1);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (showSuggestions && highlightedIndex >= 0) {
        addTag(filteredSuggestions[highlightedIndex]);
      } else if (inputText.trim()) {
        addTag(inputText);
      } else {
        // Enter with empty input commits
        onCommit();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === ',' || e.key === 'Tab') {
      if (inputText.trim()) {
        e.preventDefault();
        addTag(inputText);
      }
    } else if (e.key === 'Backspace' && inputText === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredSuggestions.length - 1,
      );
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    addTag(suggestion);
    inputRef.current?.focus();
  };

  const handleClearAll = () => {
    updateTags([]);
    setInputText('');
    onValueChange('');
    onCommit();
  };

  // Focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Global escape key on root
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

  const renderChip = (tag: string, index: number) => {
    const bgColor = getTagColor(tag);
    return (
      <span
        key={`${tag}-${index}`}
        style={{
          ...chipStyle,
          backgroundColor: bgColor,
          color: '#333',
        }}
      >
        <span style={chipTextStyle}>{tag}</span>
        <button
          type="button"
          style={chipRemoveBtnStyle}
          onClick={() => removeTag(index)}
          tabIndex={-1}
          aria-label={`Remove ${tag}`}
        >
          {'\u00D7'}
        </button>
      </span>
    );
  };

  return (
    <div
      ref={rootRef}
      style={rootStyle}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Existing tags */}
      <div style={tagsContainerStyle}>
        {tags.length > 0
          ? tags.map((tag, i) => renderChip(tag, i))
          : <span style={emptyLabelStyle}>No tags</span>}
      </div>

      {/* Input for new tags */}
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        placeholder={allowCreate ? 'Type to add tag...' : 'Search tags...'}
        style={inputStyle}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div style={suggestionsStyle}>
          {filteredSuggestions.map((suggestion, i) => (
            <div
              key={suggestion}
              style={{
                ...suggestionItemStyle,
                ...(i === highlightedIndex ? suggestionItemHoveredStyle : {}),
              }}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={footerStyle}>
        <span style={tagCountStyle}>
          {tags.length} tag{tags.length !== 1 ? 's' : ''}
        </span>
        <button type="button" style={footerBtnStyle} onClick={handleClearAll}>
          Clear all
        </button>
      </div>
    </div>
  );
}
