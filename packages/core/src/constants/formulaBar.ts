/**
 * Formula bar and formula reference highlighting constants.
 * Shared across React, Angular, Vue, and JS packages.
 */

/** Color palette for formula reference highlights (cycles 0–5). Uses CSS vars with fallbacks. */
export const FORMULA_REF_COLORS = [
  'var(--ogrid-formula-ref-0, #4285f4)',
  'var(--ogrid-formula-ref-1, #ea4335)',
  'var(--ogrid-formula-ref-2, #34a853)',
  'var(--ogrid-formula-ref-3, #9334e6)',
  'var(--ogrid-formula-ref-4, #ff6d01)',
  'var(--ogrid-formula-ref-5, #46bdc6)',
] as const;

/** CSS text for the formula bar container (used by JS and Angular inline styles). */
export const FORMULA_BAR_CSS = {
  bar: 'display:flex;align-items:center;border-bottom:1px solid var(--ogrid-border, #e0e0e0);background:var(--ogrid-bg, #fff);min-height:28px;font-size:13px;',
  nameBox: 'font-family:monospace;font-size:12px;font-weight:500;padding:2px 8px;border-right:1px solid var(--ogrid-border, #e0e0e0);background:var(--ogrid-bg, #fff);color:var(--ogrid-fg, #242424);min-width:52px;text-align:center;line-height:24px;user-select:none;white-space:nowrap;',
  fxLabel: 'padding:2px 8px;font-style:italic;font-weight:600;color:var(--ogrid-muted-fg, #888);user-select:none;border-right:1px solid var(--ogrid-border, #e0e0e0);line-height:24px;font-size:12px;',
  input: 'flex:1;border:none;outline:none;padding:2px 8px;font-family:monospace;font-size:12px;line-height:24px;background:transparent;color:var(--ogrid-fg, #242424);min-width:0;',
} as const;

/** Style objects for the formula bar — used by React and Vue (CSSProperties-compatible). */
export const FORMULA_BAR_STYLES = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid var(--ogrid-border, #e0e0e0)',
    background: 'var(--ogrid-bg, #fff)',
    minHeight: '28px',
    fontSize: '13px',
  },
  nameBox: {
    fontFamily: 'monospace',
    fontSize: '12px',
    fontWeight: 500,
    padding: '2px 8px',
    borderRight: '1px solid var(--ogrid-border, #e0e0e0)',
    background: 'var(--ogrid-bg, #fff)',
    color: 'var(--ogrid-fg, #242424)',
    minWidth: '52px',
    textAlign: 'center' as const,
    lineHeight: '24px',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
  },
  fxLabel: {
    padding: '2px 8px',
    fontStyle: 'italic',
    fontWeight: 600,
    color: 'var(--ogrid-muted-fg, #888)',
    userSelect: 'none' as const,
    borderRight: '1px solid var(--ogrid-border, #e0e0e0)',
    lineHeight: '24px',
    fontSize: '12px',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '2px 8px',
    fontFamily: 'monospace',
    fontSize: '12px',
    lineHeight: '24px',
    background: 'transparent',
    color: 'var(--ogrid-fg, #242424)',
    minWidth: 0,
  },
} as const;
