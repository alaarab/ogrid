import { parseTags, formatTags, getTagColor, filterTagSuggestions, DEFAULT_TAG_COLORS } from '@alaarab/ogrid-inputs';

/**
 * Context passed to the vanilla JS tags cell editor.
 * Matches the interface from @alaarab/ogrid-js.
 */
export interface TagsEditorContext {
  value: unknown;
  onValueChange: (value: unknown) => void;
  onCommit: () => void;
  onCancel: () => void;
  item: unknown;
  column: unknown;
  cell: HTMLTableCellElement;
  cellEditorParams?: Record<string, unknown>;
}

/**
 * Creates a multi-value tag editor cell editor for OGrid JS.
 *
 * Usage:
 *   import { createTagsEditor } from '@alaarab/ogrid-js-inputs';
 *
 *   const columns = [{
 *     columnId: 'tags',
 *     cellEditor: createTagsEditor,
 *     cellEditorPopup: true,
 *     cellEditorParams: {
 *       suggestions: ['Design', 'Frontend', 'Backend', 'Bug', 'Feature'],
 *       allowCreate: true,
 *     },
 *   }];
 */
export function createTagsEditor(context: TagsEditorContext): HTMLElement {
  const { value, onValueChange, onCommit, onCancel, cellEditorParams } = context;

  const suggestions: string[] =
    Array.isArray(cellEditorParams?.['suggestions'])
      ? (cellEditorParams['suggestions'] as string[])
      : [];
  const allowCreate: boolean =
    typeof cellEditorParams?.['allowCreate'] === 'boolean' ? cellEditorParams['allowCreate'] : true;

  // Parse initial tags
  let currentTags: string[] = parseTags(value);

  // Create root element
  const root = document.createElement('div');
  Object.assign(root.style, {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    background: 'var(--ogrid-bg, #fff)',
    color: 'var(--ogrid-fg, #242424)',
    border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
    borderRadius: '8px',
    boxShadow: 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.15))',
    padding: '12px',
    width: '260px',
    userSelect: 'none',
  });
  root.addEventListener('mousedown', (e) => e.stopPropagation());

  // --- Header ---
  const headerRow = document.createElement('div');
  Object.assign(headerRow.style, { marginBottom: '8px' });

  const headerLabel = document.createElement('span');
  headerLabel.textContent = 'Tags';
  Object.assign(headerLabel.style, { fontWeight: '600', fontSize: '13px' });
  headerRow.appendChild(headerLabel);
  root.appendChild(headerRow);

  // --- Current tags display area ---
  const tagsArea = document.createElement('div');
  Object.assign(tagsArea.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    minHeight: '28px',
    marginBottom: '8px',
    padding: '4px',
    border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
    borderRadius: '6px',
    background: 'var(--ogrid-bg-subtle, rgba(0,0,0,0.02))',
  });

  function createTagChip(tag: string): HTMLElement {
    const chip = document.createElement('span');
    const bgColor = getTagColor(tag, DEFAULT_TAG_COLORS);
    Object.assign(chip.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 6px 2px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '500',
      background: bgColor,
      color: 'var(--ogrid-fg, #242424)',
      maxWidth: '160px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });

    const tagText = document.createElement('span');
    tagText.textContent = tag;
    Object.assign(tagText.style, {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      flex: '1',
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', `Remove ${tag}`);
    removeBtn.innerHTML = '&#10005;';
    Object.assign(removeBtn.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '0',
      lineHeight: '1',
      fontSize: '10px',
      color: 'inherit',
      opacity: '0.6',
      flexShrink: '0',
    });
    removeBtn.addEventListener('mouseenter', () => { removeBtn.style.opacity = '1'; });
    removeBtn.addEventListener('mouseleave', () => { removeBtn.style.opacity = '0.6'; });
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTag(tag);
    });

    chip.appendChild(tagText);
    chip.appendChild(removeBtn);
    return chip;
  }

  function renderTagsArea() {
    tagsArea.innerHTML = '';
    if (currentTags.length === 0) {
      const placeholder = document.createElement('span');
      placeholder.textContent = 'No tags yet';
      Object.assign(placeholder.style, {
        color: 'var(--ogrid-muted, #aaa)',
        fontSize: '12px',
        alignSelf: 'center',
        padding: '2px 4px',
      });
      tagsArea.appendChild(placeholder);
    } else {
      currentTags.forEach((tag) => {
        tagsArea.appendChild(createTagChip(tag));
      });
    }
  }

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || currentTags.includes(trimmed)) return;
    currentTags = [...currentTags, trimmed];
    onValueChange(formatTags(currentTags));
    renderTagsArea();
    renderSuggestions(searchInput.value);
  }

  function removeTag(tag: string) {
    currentTags = currentTags.filter((t) => t !== tag);
    onValueChange(formatTags(currentTags));
    renderTagsArea();
    renderSuggestions(searchInput.value);
  }

  root.appendChild(tagsArea);

  // --- Search / input row ---
  const inputRow = document.createElement('div');
  Object.assign(inputRow.style, { display: 'flex', gap: '6px', marginBottom: '8px' });

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = allowCreate ? 'Search or add tag…' : 'Search tags…';
  Object.assign(searchInput.style, {
    flex: '1',
    padding: '4px 8px',
    border: '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    background: 'var(--ogrid-bg, #fff)',
    color: 'inherit',
  });

  inputRow.appendChild(searchInput);

  if (allowCreate) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Add';
    Object.assign(addBtn.style, {
      background: 'var(--ogrid-accent, #0078d4)',
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      padding: '4px 10px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      whiteSpace: 'nowrap',
    });
    addBtn.addEventListener('click', () => {
      const val = searchInput.value.trim();
      if (val) {
        addTag(val);
        searchInput.value = '';
        renderSuggestions('');
      }
    });
    inputRow.appendChild(addBtn);
  }

  root.appendChild(inputRow);

  // --- Suggestions dropdown ---
  const suggestionsBox = document.createElement('div');
  Object.assign(suggestionsBox.style, {
    maxHeight: '140px',
    overflowY: 'auto',
    border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
    borderRadius: '6px',
    marginBottom: '8px',
    display: 'none',
  });

  function renderSuggestions(query: string) {
    suggestionsBox.innerHTML = '';
    const filtered = filterTagSuggestions(query, suggestions, currentTags);

    if (filtered.length === 0) {
      suggestionsBox.style.display = 'none';
      return;
    }

    suggestionsBox.style.display = 'block';

    filtered.slice(0, 10).forEach((tag) => {
      const item = document.createElement('div');
      item.textContent = tag;
      Object.assign(item.style, {
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: '13px',
        borderBottom: '1px solid var(--ogrid-border, rgba(0,0,0,0.06))',
      });
      item.addEventListener('mouseenter', () => {
        item.style.background = 'var(--ogrid-bg-hover, #f0f0f0)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
      });
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent blur on input
        addTag(tag);
        searchInput.value = '';
        renderSuggestions('');
        searchInput.focus();
      });
      suggestionsBox.appendChild(item);
    });
  }

  root.appendChild(suggestionsBox);

  searchInput.addEventListener('input', () => {
    renderSuggestions(searchInput.value);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const val = searchInput.value.trim();
      if (val && allowCreate) {
        addTag(val);
        searchInput.value = '';
        renderSuggestions('');
      } else if (!val) {
        // Commit on Enter with empty input
        onCommit();
      }
    }
    if (e.key === 'Backspace' && searchInput.value === '' && currentTags.length > 0) {
      // Remove last tag on backspace when input is empty
      removeTag(currentTags[currentTags.length - 1]);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      const val = searchInput.value.trim();
      if (val && allowCreate) {
        addTag(val);
        searchInput.value = '';
        renderSuggestions('');
      }
    }
  });

  searchInput.addEventListener('focus', () => {
    renderSuggestions(searchInput.value);
  });

  searchInput.addEventListener('blur', () => {
    // Delay hide to allow suggestion click to register
    setTimeout(() => {
      suggestionsBox.style.display = 'none';
    }, 150);
  });

  // --- Footer ---
  const footer = document.createElement('div');
  Object.assign(footer.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '8px',
    borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
  });

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear all';
  Object.assign(clearBtn.style, {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    color: 'var(--ogrid-accent, #0078d4)',
    fontWeight: '500',
  });
  clearBtn.addEventListener('click', () => {
    currentTags = [];
    onValueChange('');
    renderTagsArea();
    renderSuggestions('');
  });

  const doneBtn = document.createElement('button');
  doneBtn.type = 'button';
  doneBtn.textContent = 'Done';
  Object.assign(doneBtn.style, {
    background: 'var(--ogrid-accent, #0078d4)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  });
  doneBtn.addEventListener('click', () => {
    onValueChange(formatTags(currentTags));
    onCommit();
  });

  footer.appendChild(clearBtn);
  footer.appendChild(doneBtn);
  root.appendChild(footer);

  // Global Escape handler
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  });

  // Initial render
  renderTagsArea();

  // Show suggestions immediately if there are any and no tags yet
  if (suggestions.length > 0) {
    renderSuggestions('');
  }

  // Focus input
  setTimeout(() => searchInput.focus(), 0);

  return root;
}
