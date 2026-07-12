/**
 * TagsEditor  -  Premium multi-value tag/chip cell editor for OGrid.
 *
 * Usage:
 *   import { TagsEditor } from '@alaarab/ogrid-react-inputs';
 *
 *   const columns = [{
 *     columnId: 'labels',
 *     cellEditor: TagsEditor,
 *     cellEditorPopup: true,
 *     cellEditorParams: {
 *       suggestions: ['Bug', 'Feature', 'Docs'],
 *       allowCreate: true,   // default: true — set to false to restrict to suggestions
 *       showApplyButton: true, // default: true — shows an Apply button to commit
 *     },
 *   }];
 *
 * When `allowCreate: false`, users can only select from the provided `suggestions`.
 * When suggestions are provided and `allowCreate: false`, the dropdown shows multi-select
 * behavior (checkboxes) similar to Select2 — all options shown by default, filtered as user types.
 *
 * Implements ICellEditorProps<T>  -  works with cellEditorPopup: true.
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
  boxSizing: 'border-box',
};

const suggestionsStyle: React.CSSProperties = {
  maxHeight: '160px',
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
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const suggestionItemHoveredStyle: React.CSSProperties = {
  background: 'var(--ogrid-bg-hover, #f0f0f0)',
};

const suggestionCheckStyle: React.CSSProperties = {
  width: '14px',
  height: '14px',
  borderRadius: '3px',
  border: '1.5px solid var(--ogrid-border, rgba(0,0,0,0.3))',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontSize: '10px',
  background: 'var(--ogrid-bg, #fff)',
};

const suggestionCheckCheckedStyle: React.CSSProperties = {
  background: 'var(--ogrid-accent, #0078d4)',
  border: '1.5px solid var(--ogrid-accent, #0078d4)',
  color: '#fff',
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

const applyBtnStyle: React.CSSProperties = {
  background: 'var(--ogrid-accent, #0078d4)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  padding: '5px 12px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
};

const tagCountStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--ogrid-muted, #888)',
};

// ── Component ──

let tagsEditorInstanceCounter = 0;

export function TagsEditor<T>(props: ICellEditorProps<T>): React.ReactElement {
  const { value, onValueChange, onCommit, onCancel, cellEditorParams } = props;

  const params = cellEditorParams as Record<string, unknown> | undefined;
  const suggestions = params?.suggestions as string[] | undefined;
  const allowCreate = (params?.allowCreate as boolean | undefined) ?? true;
  const showApplyButton = (params?.showApplyButton as boolean | undefined) ?? true;

  // Multi-select mode: suggestions provided and allowCreate is false
  const isMultiSelectMode = !!suggestions && !allowCreate;

  const [tags, setTags] = React.useState<string[]>(() => parseTags(value));
  const [inputText, setInputText] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Stable per-instance id linking the combobox input to its listbox
  // (React.useId needs React 18; this package supports React 17 peers).
  const listboxId = React.useRef(`ogrid-tags-listbox-${++tagsEditorInstanceCounter}`).current;

  // In multi-select mode: show all available suggestions (not yet selected) when input is empty,
  // or filter them when user types. In regular mode: only show suggestions when typing.
  const filteredSuggestions = React.useMemo(() => {
    if (!suggestions) return [];
    if (isMultiSelectMode) {
      // Show all suggestions (with selected state tracked separately) filtered by search
      const q = inputText.toLowerCase().trim();
      return suggestions.filter((s) => !q || s.toLowerCase().includes(q));
    }
    return filterTagSuggestions(inputText, suggestions, tags);
  }, [inputText, suggestions, tags, isMultiSelectMode]);

  const showSuggestions = isMultiSelectMode
    ? filteredSuggestions.length > 0
    : filteredSuggestions.length > 0 && inputText.length > 0;

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

  const toggleTag = React.useCallback(
    (tag: string) => {
      if (tags.includes(tag)) {
        const newTags = tags.filter((t) => t !== tag);
        updateTags(newTags);
      } else {
        const newTags = [...tags, tag];
        updateTags(newTags);
      }
    },
    [tags, updateTags],
  );

  const handleApply = () => {
    onCommit();
  };

  const handleClearAll = () => {
    updateTags([]);
    setInputText('');
    onValueChange('');
    if (!showApplyButton) {
      onCommit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    setHighlightedIndex(-1);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (isMultiSelectMode) {
        // In multi-select mode, Enter toggles the highlighted suggestion or applies
        const highlighted = filteredSuggestions[highlightedIndex];
        if (showSuggestions && highlightedIndex >= 0 && highlighted !== undefined) {
          toggleTag(highlighted);
        } else if (!showApplyButton) {
          onCommit();
        } else {
          onCommit();
        }
      } else if (showSuggestions && highlightedIndex >= 0 && filteredSuggestions[highlightedIndex] !== undefined) {
        addTag(filteredSuggestions[highlightedIndex]);
      } else if (inputText.trim()) {
        addTag(inputText);
      } else {
        // Enter with empty input: commit if no apply button, otherwise do nothing
        if (!showApplyButton) {
          onCommit();
        } else {
          onCommit();
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (!isMultiSelectMode && (e.key === ',' || e.key === 'Tab')) {
      if (inputText.trim()) {
        e.preventDefault();
        addTag(inputText);
      }
    } else if (e.key === 'Backspace' && inputText === '' && tags.length > 0 && !isMultiSelectMode) {
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
    if (isMultiSelectMode) {
      toggleTag(suggestion);
      inputRef.current?.focus();
    } else {
      addTag(suggestion);
      inputRef.current?.focus();
    }
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

  const renderSuggestionItem = (suggestion: string, i: number) => {
    const isSelected = tags.includes(suggestion);
    const isHighlighted = i === highlightedIndex;

    if (isMultiSelectMode) {
      return (
        // biome-ignore lint/a11y/useKeyWithClickEvents: ARIA combobox pattern — keyboard selection (arrows/Enter) is handled by the combobox input's onKeyDown; onClick is the pointer path
        // biome-ignore lint/a11y/useFocusableInteractive: options are intentionally not focusable; focus stays on the combobox input and aria-activedescendant tracks the active option
        <div
          key={suggestion}
          id={`${listboxId}-opt-${i}`}
          role="option"
          aria-selected={isSelected}
          style={{
            ...suggestionItemStyle,
            ...(isHighlighted ? suggestionItemHoveredStyle : {}),
          }}
          onClick={() => handleSuggestionClick(suggestion)}
          onMouseEnter={() => setHighlightedIndex(i)}
        >
          <span
            style={{
              ...suggestionCheckStyle,
              ...(isSelected ? suggestionCheckCheckedStyle : {}),
            }}
          >
            {isSelected ? '\u2713' : ''}
          </span>
          <span style={{ flex: 1 }}>{suggestion}</span>
        </div>
      );
    }

    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: ARIA combobox pattern — keyboard selection (arrows/Enter) is handled by the combobox input's onKeyDown; onClick is the pointer path
      // biome-ignore lint/a11y/useFocusableInteractive: options are intentionally not focusable; focus stays on the combobox input and aria-activedescendant tracks the active option
      <div
        key={suggestion}
        id={`${listboxId}-opt-${i}`}
        role="option"
        aria-selected={isSelected}
        style={{
          ...suggestionItemStyle,
          ...(isHighlighted ? suggestionItemHoveredStyle : {}),
        }}
        onClick={() => handleSuggestionClick(suggestion)}
        onMouseEnter={() => setHighlightedIndex(i)}
      >
        {suggestion}
      </div>
    );
  };

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: popup editor root; onMouseDown only stops propagation so the grid does not treat clicks as outside-clicks. Keyboard is handled by the combobox input and a root-level Escape listener.
    // biome-ignore lint/a11y/noStaticElementInteractions: see above — propagation guard, not an interactive control
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

      {/* Search/input for tags */}
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        placeholder={isMultiSelectMode ? 'Search...' : allowCreate ? 'Type to add tag...' : 'Search tags...'}
        style={inputStyle}
        aria-label="Tag search input"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          showSuggestions && highlightedIndex >= 0 ? `${listboxId}-opt-${highlightedIndex}` : undefined
        }
      />

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div id={listboxId} role="listbox" aria-label="Tag suggestions" style={suggestionsStyle}>
          {filteredSuggestions.map((suggestion, i) => renderSuggestionItem(suggestion, i))}
        </div>
      )}

      {/* Footer */}
      <div style={footerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={tagCountStyle}>
            {tags.length} tag{tags.length !== 1 ? 's' : ''}
          </span>
          <button type="button" style={footerBtnStyle} onClick={handleClearAll}>
            Clear all
          </button>
        </div>
        {showApplyButton && (
          <button type="button" style={applyBtnStyle} onClick={handleApply} aria-label="Apply tags">
            Apply
          </button>
        )}
      </div>
    </div>
  );
}
