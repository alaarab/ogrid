/**
 * Self-injecting CSS for DataGridTable body cells.
 * Uses native HTML elements with CSS classes instead of MUI sx prop,
 * eliminating ~1000 Emotion resolutions per render.
 * Injected once via <style> tag on first import.
 */

const STYLES = `
.ogrid-mat-row:hover > td { background-color: var(--ogrid-hover-bg); }
.ogrid-mat-row--selected > td { background-color: var(--ogrid-selection-bg, rgba(25, 118, 210, 0.08)); }

.ogrid-mat-td { position: relative; padding: 0; height: 1px; border-bottom: 1px solid var(--ogrid-border, rgba(224,224,224,1)); }
.ogrid-mat-td--pinned-left { position: sticky; left: 0; z-index: var(--ogrid-z-pinned, 6); background-color: var(--ogrid-paper-bg, #fff); will-change: transform; border-right: 1px solid var(--ogrid-border, rgba(224,224,224,1)); box-shadow: 2px 0 4px -1px rgba(0,0,0,0.1); }
.ogrid-mat-td--pinned-right { position: sticky; right: 0; z-index: var(--ogrid-z-pinned, 6); background-color: var(--ogrid-paper-bg, #fff); will-change: transform; border-left: 1px solid var(--ogrid-border, rgba(224,224,224,1)); box-shadow: -2px 0 4px -1px rgba(0,0,0,0.1); }

.ogrid-mat-cell { width: 100%; height: 100%; display: flex; align-items: center; min-width: 0; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; user-select: none; outline: none; contain: content; }
.ogrid-mat-cell:focus-visible { outline: 2px solid var(--ogrid-primary, #1976d2); outline-offset: -2px; z-index: 3; }
.ogrid-mat-td--pinned-left .ogrid-mat-cell, .ogrid-mat-td--pinned-right .ogrid-mat-cell { contain: none; }
table:not([data-virtual-scroll]) .ogrid-mat-tbody tr { content-visibility: auto; }

.ogrid-mat-cell--numeric { justify-content: flex-end; text-align: right; }
.ogrid-mat-cell--boolean { justify-content: center; text-align: center; }
.ogrid-mat-cell--editable { cursor: cell; }

.ogrid-mat-cell--active { outline: 2px solid var(--ogrid-selection, #217346); outline-offset: -1px; z-index: var(--ogrid-z-active-cell, 2); position: relative; overflow: visible; background-color: var(--ogrid-hover-bg); }
.ogrid-mat-cell--active:focus-visible { outline: 2px solid var(--ogrid-selection, #217346); outline-offset: -1px; }
.ogrid-mat-cell--active-in-range { outline: none; background-color: var(--ogrid-bg, #fff); }
.ogrid-mat-cell--range { background-color: var(--ogrid-bg-range, rgba(33,115,70,0.12)); }
.ogrid-mat-cell--range:focus-visible { outline: none; }
.ogrid-mat-cell--cut { background-color: var(--ogrid-hover-bg); opacity: 0.7; }

.ogrid-mat-fill-handle { position: absolute; right: -3px; bottom: -3px; width: 7px; height: 7px; background-color: var(--ogrid-selection, #217346); border: 1px solid var(--ogrid-bg, #fff); border-radius: 1px; cursor: crosshair; pointer-events: auto; z-index: var(--ogrid-z-fill-handle, 3); }

.ogrid-mat-checkbox-wrapper { display: flex; align-items: center; justify-content: center; }

.ogrid-mat-row-number { text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ogrid-fg-secondary); background-color: var(--ogrid-hover-bg); position: sticky; z-index: var(--ogrid-z-row-number, 5); }

.ogrid-mat-tbody tr:last-child > td { border-bottom: none; }

.ogrid-mat-wrapper [data-drag-range] { background-color: rgba(33,115,70,0.12); }
.ogrid-mat-wrapper [data-drag-anchor] { background-color: var(--ogrid-paper-bg, #fff); }
`;

let injected = false;

export function injectDataGridStyles(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.setAttribute('data-ogrid-mat', '');
  style.textContent = STYLES;
  document.head.appendChild(style);
}
