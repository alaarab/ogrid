import { clampRating, getStarFill, getRatingFromPosition, DEFAULT_MAX_STARS } from '@alaarab/ogrid-inputs';

/**
 * Context passed to the vanilla JS rating cell editor.
 * Matches the interface from @alaarab/ogrid-js.
 */
export interface RatingEditorContext {
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
 * Creates a star-rating cell editor for OGrid JS.
 *
 * Usage:
 *   import { createRatingEditor } from '@alaarab/ogrid-js-inputs';
 *
 *   const columns = [{
 *     columnId: 'rating',
 *     cellEditor: createRatingEditor,
 *     cellEditorPopup: true,
 *     cellEditorParams: { maxStars: 5, allowHalf: false },
 *   }];
 */
export function createRatingEditor(context: RatingEditorContext): HTMLElement {
  const { value, onValueChange, onCommit, onCancel, cellEditorParams } = context;

  const maxStars: number =
    typeof cellEditorParams?.['maxStars'] === 'number' ? cellEditorParams['maxStars'] : DEFAULT_MAX_STARS;
  const allowHalf: boolean =
    typeof cellEditorParams?.['allowHalf'] === 'boolean' ? cellEditorParams['allowHalf'] : false;

  // Parse initial rating value
  let currentRating: number = clampRating(
    value != null && !isNaN(Number(value)) ? Number(value) : 0,
    maxStars,
  );
  let hoverRating: number | null = null;

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
    userSelect: 'none',
  });
  root.addEventListener('mousedown', (e) => e.stopPropagation());

  // --- Label row ---
  const labelRow = document.createElement('div');
  Object.assign(labelRow.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  });

  const label = document.createElement('span');
  label.textContent = 'Rating';
  Object.assign(label.style, { fontWeight: '600', fontSize: '13px' });

  const valueDisplay = document.createElement('span');
  Object.assign(valueDisplay.style, {
    fontSize: '12px',
    color: 'var(--ogrid-muted, #888)',
    minWidth: '32px',
    textAlign: 'right',
  });

  labelRow.appendChild(label);
  labelRow.appendChild(valueDisplay);
  root.appendChild(labelRow);

  // --- Stars row ---
  const starsRow = document.createElement('div');
  Object.assign(starsRow.style, {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    marginBottom: '10px',
  });

  const starButtons: HTMLButtonElement[] = [];

  function renderStars(displayRating: number) {
    for (let i = 0; i < maxStars; i++) {
      const fill = getStarFill(i, displayRating, allowHalf);
      const btn = starButtons[i];
      if (!btn) continue;
      if (fill === 'full') {
        btn.innerHTML = '&#9733;'; // filled star
        btn.style.color = 'var(--ogrid-accent, #f5a623)';
      } else if (fill === 'half') {
        // Half star using a gradient technique via a span overlay
        btn.innerHTML = '<span style="position:relative;display:inline-block;">' +
          '<span style="color:var(--ogrid-muted,#ccc)">&#9733;</span>' +
          '<span style="position:absolute;left:0;top:0;width:50%;overflow:hidden;color:var(--ogrid-accent,#f5a623)">&#9733;</span>' +
          '</span>';
      } else {
        btn.innerHTML = '&#9733;'; // empty star (muted)
        btn.style.color = 'var(--ogrid-muted, #ccc)';
      }
    }
  }

  function updateValueDisplay(rating: number) {
    valueDisplay.textContent = rating === 0 ? '—' : `${rating} / ${maxStars}`;
  }

  for (let i = 0; i < maxStars; i++) {
    const starIndex = i;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `${starIndex + 1} star${starIndex + 1 !== 1 ? 's' : ''}`);
    Object.assign(btn.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '2px',
      fontSize: '28px',
      lineHeight: '1',
      transition: 'transform 0.1s ease',
      color: 'var(--ogrid-muted, #ccc)',
    });

    btn.addEventListener('mouseenter', (e) => {
      const rect = btn.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      hoverRating = getRatingFromPosition(starIndex, offsetX, rect.width, allowHalf);
      btn.style.transform = 'scale(1.15)';
      renderStars(hoverRating);
      updateValueDisplay(hoverRating);
    });

    btn.addEventListener('mouseleave', () => {
      hoverRating = null;
      btn.style.transform = 'scale(1)';
      renderStars(currentRating);
      updateValueDisplay(currentRating);
    });

    btn.addEventListener('click', (e) => {
      const rect = btn.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const newRating = getRatingFromPosition(starIndex, offsetX, rect.width, allowHalf);
      // Toggle off if clicking the same value
      currentRating = currentRating === newRating ? 0 : clampRating(newRating, maxStars);
      hoverRating = null;
      onValueChange(currentRating);
      renderStars(currentRating);
      updateValueDisplay(currentRating);
      setTimeout(() => onCommit(), 0);
    });

    starButtons.push(btn);
    starsRow.appendChild(btn);
  }

  root.appendChild(starsRow);

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
  clearBtn.textContent = 'Clear';
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
    currentRating = 0;
    onValueChange(0);
    renderStars(0);
    updateValueDisplay(0);
    onCommit();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  Object.assign(cancelBtn.style, {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    color: 'var(--ogrid-muted, #888)',
    fontWeight: '500',
  });
  cancelBtn.addEventListener('click', () => onCancel());

  footer.appendChild(clearBtn);
  footer.appendChild(cancelBtn);
  root.appendChild(footer);

  // Global Escape handler
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  });

  // Initial render
  renderStars(currentRating);
  updateValueDisplay(currentRating);

  return root;
}
