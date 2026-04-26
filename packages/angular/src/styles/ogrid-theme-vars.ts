/**
 * Shared OGrid CSS theme variables (light + dark mode).
 * Used by all Angular UI packages (Material, PrimeNG, Radix) to avoid duplication.
 *
 * Uses :where() selectors for ZERO specificity  -  consumer overrides always win.
 * Dark mode: auto via prefers-color-scheme, explicit via [data-theme="dark"]
 * or .dark (Tailwind/shadcn convention). Opt out of auto-dark with .light or
 * [data-theme="light"] on :root.
 */
export const OGRID_THEME_VARS_CSS = `
/* ─── OGrid Light Theme (default) ─── */
:where(:root) {
  --ogrid-bg: #ffffff;
  --ogrid-fg: rgba(0, 0, 0, 0.87);
  --ogrid-fg-secondary: rgba(0, 0, 0, 0.6);
  --ogrid-fg-muted: rgba(0, 0, 0, 0.5);
  --ogrid-border: rgba(0, 0, 0, 0.12);
  --ogrid-border-strong: rgba(0, 0, 0, 0.5);
  --ogrid-border-hover: rgba(0, 0, 0, 0.3);
  --ogrid-header-bg: #f5f5f5;
  --ogrid-hover-bg: rgba(0, 0, 0, 0.04);
  --ogrid-selected-row-bg: #e6f0fb;
  --ogrid-bg-selected-hover: #dae8f8;
  --ogrid-active-cell-bg: rgba(0, 0, 0, 0.02);
  --ogrid-range-bg: rgba(33, 115, 70, 0.12);
  --ogrid-accent: #0078d4;
  --ogrid-accent-dark: #005a9e;
  --ogrid-selection-color: #217346;
  --ogrid-primary: oklch(0.55 0 0);
  --ogrid-primary-fg: oklch(1 0 0);
  --ogrid-primary-hover: oklch(0.45 0 0);
  --ogrid-bg-subtle: #f5f5f5;
  --ogrid-bg-hover: rgba(0, 0, 0, 0.04);
  --ogrid-active-bg: rgba(0, 0, 0, 0.06);
  --ogrid-muted: rgba(0, 0, 0, 0.5);
  --ogrid-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  --ogrid-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.08);
  --ogrid-pinned-shadow: rgba(0, 0, 0, 0.1);
  --ogrid-loading-overlay: rgba(255, 255, 255, 0.7);
}
/* ─── Auto Dark (system preference) ─── */
@media (prefers-color-scheme: dark) {
  :where(:root:not([data-theme="light"]):not(.light)) {
    --ogrid-bg: #1e1e1e;
    --ogrid-fg: rgba(255, 255, 255, 0.87);
    --ogrid-fg-secondary: rgba(255, 255, 255, 0.6);
    --ogrid-fg-muted: rgba(255, 255, 255, 0.5);
    --ogrid-border: rgba(255, 255, 255, 0.12);
    --ogrid-border-strong: rgba(255, 255, 255, 0.5);
    --ogrid-border-hover: rgba(255, 255, 255, 0.3);
    --ogrid-header-bg: #2c2c2c;
    --ogrid-hover-bg: rgba(255, 255, 255, 0.08);
    --ogrid-selected-row-bg: #1a3a5c;
    --ogrid-bg-selected-hover: #1f3650;
    --ogrid-active-cell-bg: rgba(255, 255, 255, 0.06);
    --ogrid-range-bg: rgba(46, 160, 67, 0.15);
    --ogrid-accent: #4da6ff;
    --ogrid-accent-dark: #3390e0;
    --ogrid-selection-color: #2ea043;
    --ogrid-primary: oklch(0.7 0 0);
    --ogrid-primary-fg: oklch(0.1 0 0);
    --ogrid-primary-hover: oklch(0.8 0 0);
    --ogrid-bg-subtle: rgba(255, 255, 255, 0.04);
    --ogrid-bg-hover: rgba(255, 255, 255, 0.08);
    --ogrid-active-bg: rgba(255, 255, 255, 0.08);
    --ogrid-muted: rgba(255, 255, 255, 0.5);
    --ogrid-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    --ogrid-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.25);
    --ogrid-pinned-shadow: rgba(0, 0, 0, 0.3);
    --ogrid-loading-overlay: rgba(0, 0, 0, 0.7);
  }
}
/* ─── Explicit Dark ─── */
:where([data-theme="dark"], .dark) {
  --ogrid-bg: #1e1e1e;
  --ogrid-fg: rgba(255, 255, 255, 0.87);
  --ogrid-fg-secondary: rgba(255, 255, 255, 0.6);
  --ogrid-fg-muted: rgba(255, 255, 255, 0.5);
  --ogrid-border: rgba(255, 255, 255, 0.12);
  --ogrid-border-strong: rgba(255, 255, 255, 0.5);
  --ogrid-border-hover: rgba(255, 255, 255, 0.3);
  --ogrid-header-bg: #2c2c2c;
  --ogrid-hover-bg: rgba(255, 255, 255, 0.08);
  --ogrid-selected-row-bg: #1a3a5c;
  --ogrid-bg-selected-hover: #1f3650;
  --ogrid-active-cell-bg: rgba(255, 255, 255, 0.06);
  --ogrid-range-bg: rgba(46, 160, 67, 0.15);
  --ogrid-accent: #4da6ff;
  --ogrid-accent-dark: #3390e0;
  --ogrid-selection-color: #2ea043;
  --ogrid-primary: oklch(0.7 0 0);
  --ogrid-primary-fg: oklch(0.1 0 0);
  --ogrid-primary-hover: oklch(0.8 0 0);
  --ogrid-bg-subtle: rgba(255, 255, 255, 0.04);
  --ogrid-bg-hover: rgba(255, 255, 255, 0.08);
  --ogrid-active-bg: rgba(255, 255, 255, 0.08);
  --ogrid-muted: rgba(255, 255, 255, 0.5);
  --ogrid-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  --ogrid-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.25);
  --ogrid-pinned-shadow: rgba(0, 0, 0, 0.3);
  --ogrid-loading-overlay: rgba(0, 0, 0, 0.7);
}`;
