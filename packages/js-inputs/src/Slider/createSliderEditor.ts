import { clampValue, snapToStep, getPercentage, getValueFromOffset, DEFAULT_MIN, DEFAULT_MAX, DEFAULT_STEP } from '@alaarab/ogrid-inputs';

/**
 * Context passed to the vanilla JS slider cell editor.
 * Matches the interface from @alaarab/ogrid-js.
 */
export interface SliderEditorContext {
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
 * Creates a range slider cell editor for OGrid JS.
 *
 * Usage:
 *   import { createSliderEditor } from '@alaarab/ogrid-js-inputs';
 *
 *   const columns = [{
 *     columnId: 'progress',
 *     cellEditor: createSliderEditor,
 *     cellEditorPopup: true,
 *     cellEditorParams: { min: 0, max: 100, step: 5 },
 *   }];
 */
export function createSliderEditor(context: SliderEditorContext): HTMLElement {
  const { value, onValueChange, onCommit, onCancel, cellEditorParams } = context;

  const min: number =
    typeof cellEditorParams?.['min'] === 'number' ? cellEditorParams['min'] : DEFAULT_MIN;
  const max: number =
    typeof cellEditorParams?.['max'] === 'number' ? cellEditorParams['max'] : DEFAULT_MAX;
  const step: number =
    typeof cellEditorParams?.['step'] === 'number' ? cellEditorParams['step'] : DEFAULT_STEP;

  // Parse initial value
  let currentValue: number = clampValue(
    value != null && !isNaN(Number(value)) ? snapToStep(Number(value), min, step) : min,
    min,
    max,
  );

  // Drag state
  let isDragging = false;

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
    width: '240px',
    userSelect: 'none',
  });
  root.addEventListener('mousedown', (e) => e.stopPropagation());

  // --- Header row ---
  const headerRow = document.createElement('div');
  Object.assign(headerRow.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  });

  const headerLabel = document.createElement('span');
  headerLabel.textContent = 'Value';
  Object.assign(headerLabel.style, { fontWeight: '600', fontSize: '13px' });

  const valueDisplay = document.createElement('span');
  Object.assign(valueDisplay.style, {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--ogrid-accent, #0078d4)',
    minWidth: '40px',
    textAlign: 'right',
  });
  valueDisplay.textContent = String(currentValue);

  headerRow.appendChild(headerLabel);
  headerRow.appendChild(valueDisplay);
  root.appendChild(headerRow);

  // --- Slider track area ---
  const trackWrapper = document.createElement('div');
  Object.assign(trackWrapper.style, {
    position: 'relative',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px',
    cursor: 'pointer',
  });

  // Track background
  const track = document.createElement('div');
  Object.assign(track.style, {
    position: 'absolute',
    left: '0',
    right: '0',
    height: '4px',
    borderRadius: '2px',
    background: 'var(--ogrid-border, rgba(0,0,0,0.15))',
  });

  // Track fill (accent colored portion left of thumb)
  const fill = document.createElement('div');
  Object.assign(fill.style, {
    position: 'absolute',
    left: '0',
    height: '4px',
    borderRadius: '2px',
    background: 'var(--ogrid-accent, #0078d4)',
    pointerEvents: 'none',
  });

  // Thumb
  const thumb = document.createElement('div');
  Object.assign(thumb.style, {
    position: 'absolute',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: 'var(--ogrid-accent, #0078d4)',
    border: '2px solid #fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
    cursor: 'grab',
    transform: 'translateX(-50%)',
    transition: 'box-shadow 0.1s ease',
    zIndex: '1',
  });

  trackWrapper.appendChild(track);
  trackWrapper.appendChild(fill);
  trackWrapper.appendChild(thumb);
  root.appendChild(trackWrapper);

  function updateSliderUI() {
    const pct = getPercentage(currentValue, min, max);
    fill.style.width = `${pct}%`;
    thumb.style.left = `${pct}%`;
    valueDisplay.textContent = String(currentValue);
  }

  function getValueFromEvent(e: MouseEvent): number {
    const rect = track.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    return getValueFromOffset(offsetX, rect.width, min, max, step);
  }

  // Track / thumb mouse interactions
  trackWrapper.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    thumb.style.cursor = 'grabbing';
    thumb.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
    const newValue = getValueFromEvent(e);
    currentValue = newValue;
    onValueChange(currentValue);
    updateSliderUI();
  });

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const newValue = getValueFromEvent(e);
    if (newValue !== currentValue) {
      currentValue = newValue;
      onValueChange(currentValue);
      updateSliderUI();
    }
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    thumb.style.cursor = 'grab';
    thumb.style.boxShadow = '0 1px 4px rgba(0,0,0,0.25)';
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  // --- Range labels ---
  const rangeRow = document.createElement('div');
  Object.assign(rangeRow.style, {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '10px',
  });

  const minLabel = document.createElement('span');
  minLabel.textContent = String(min);
  Object.assign(minLabel.style, { fontSize: '11px', color: 'var(--ogrid-muted, #888)' });

  const maxLabel = document.createElement('span');
  maxLabel.textContent = String(max);
  Object.assign(maxLabel.style, { fontSize: '11px', color: 'var(--ogrid-muted, #888)' });

  rangeRow.appendChild(minLabel);
  rangeRow.appendChild(maxLabel);
  root.appendChild(rangeRow);

  // --- Number input row ---
  const inputRow = document.createElement('div');
  Object.assign(inputRow.style, { display: 'flex', gap: '6px', marginBottom: '10px' });

  const numInput = document.createElement('input');
  numInput.type = 'number';
  numInput.value = String(currentValue);
  numInput.min = String(min);
  numInput.max = String(max);
  numInput.step = String(step);
  Object.assign(numInput.style, {
    flex: '1',
    padding: '4px 8px',
    border: '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    background: 'var(--ogrid-bg, #fff)',
    color: 'inherit',
  });

  numInput.addEventListener('input', () => {
    const parsed = parseFloat(numInput.value);
    if (!isNaN(parsed)) {
      currentValue = clampValue(snapToStep(parsed, min, step), min, max);
      onValueChange(currentValue);
      updateSliderUI();
    }
  });

  numInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onValueChange(currentValue);
      onCommit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  });

  inputRow.appendChild(numInput);
  root.appendChild(inputRow);

  // --- Footer ---
  const footer = document.createElement('div');
  Object.assign(footer.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '8px',
    borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
  });

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.textContent = 'Apply';
  Object.assign(applyBtn.style, {
    background: 'var(--ogrid-accent, #0078d4)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  });
  applyBtn.addEventListener('click', () => {
    onValueChange(currentValue);
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

  footer.appendChild(cancelBtn);
  footer.appendChild(applyBtn);
  root.appendChild(footer);

  // Global Escape handler
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
    // Arrow key nudging
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      currentValue = clampValue(snapToStep(currentValue + step, min, step), min, max);
      numInput.value = String(currentValue);
      onValueChange(currentValue);
      updateSliderUI();
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      currentValue = clampValue(snapToStep(currentValue - step, min, step), min, max);
      numInput.value = String(currentValue);
      onValueChange(currentValue);
      updateSliderUI();
    }
  });

  // Cleanup global listeners when the root is removed
  const observer = new MutationObserver(() => {
    if (!document.contains(root)) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial render
  updateSliderUI();

  // Focus input
  setTimeout(() => {
    numInput.focus();
    numInput.select();
  }, 0);

  return root;
}
