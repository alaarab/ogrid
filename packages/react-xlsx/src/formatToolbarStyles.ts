// Stylesheet for FormatToolbar, injected with the toolbar as a <style> tag so
// the browser bundle needs no CSS loader. Colors come from the grid's
// --ogrid-* theme variables, so the toolbar follows light and dark themes.

export const FORMAT_TOOLBAR_CSS = `
.ogrid-xtb {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  flex: 0 0 auto;
  gap: 1px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--ogrid-border, #e0e0e0);
  background: var(--ogrid-header-bg, #f5f5f5);
  color: var(--ogrid-fg, #242424);
  font-family: var(--ogrid-font, inherit);
  font-size: 12px;
  line-height: 1;
}
.ogrid-xtb-group { display: inline-flex; align-items: center; gap: 1px; }
.ogrid-xtb-sep {
  width: 1px;
  height: 18px;
  margin: 0 5px;
  background: var(--ogrid-border, #e0e0e0);
  flex: 0 0 auto;
}
.ogrid-xtb-spacer { flex: 1 1 auto; }
.ogrid-xtb-anchor { position: relative; display: inline-flex; }
.ogrid-xtb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  margin: 0;
  border: 0;
  border-radius: var(--ogrid-radius-sm, 4px);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 80ms ease, opacity 80ms ease;
}
.ogrid-xtb-btn.ogrid-xtb-icon { width: 28px; padding: 0; }
.ogrid-xtb-btn svg { display: block; flex: 0 0 auto; }
.ogrid-xtb-btn:hover:not(:disabled) { background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.05)); }
.ogrid-xtb-btn:active:not(:disabled) { background: var(--ogrid-active-bg, rgba(0, 0, 0, 0.08)); }
.ogrid-xtb-btn[aria-pressed="true"],
.ogrid-xtb-btn[aria-expanded="true"] {
  background: var(--ogrid-range-bg, rgba(33, 115, 70, 0.12));
  color: var(--ogrid-fg, #242424);
}
.ogrid-xtb-btn[aria-pressed="true"]:hover:not(:disabled) {
  background: var(--ogrid-range-bg, rgba(33, 115, 70, 0.12));
  box-shadow: inset 0 0 0 1px var(--ogrid-primary, #217346);
}
.ogrid-xtb-btn:focus-visible,
.ogrid-xtb-item:focus-visible,
.ogrid-xtb-swatch:focus-visible,
.ogrid-xtb-custom:focus-within {
  outline: 2px solid var(--ogrid-ring, var(--ogrid-primary, #217346));
  outline-offset: -2px;
}
.ogrid-xtb-btn:disabled { opacity: 0.35; cursor: default; }
.ogrid-xtb-color { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; }
.ogrid-xtb-bar {
  width: 16px;
  height: 3px;
  border-radius: 1px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ogrid-fg, #242424) 22%, transparent);
}
.ogrid-xtb-format { min-width: 116px; justify-content: flex-start; padding: 0 6px 0 4px; }
.ogrid-xtb-format .ogrid-xtb-chevron { margin-left: auto; opacity: 0.6; }
.ogrid-xtb-123 {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 16px;
  padding: 0 2px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.05));
  box-shadow: inset 0 0 0 1px var(--ogrid-border, #e0e0e0);
}
.ogrid-xtb-export { padding: 0 10px 0 8px; font-weight: 500; }
.ogrid-xtb-pop {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: var(--ogrid-z-popover, 10001);
  min-width: 100%;
  padding: 6px;
  border: 1px solid var(--ogrid-border, #e0e0e0);
  border-radius: var(--ogrid-radius, 6px);
  background: var(--ogrid-bg, #fff);
  color: var(--ogrid-fg, #242424);
  box-shadow: var(--ogrid-shadow, 0 4px 16px rgba(0, 0, 0, 0.12)), 0 0 0 1px color-mix(in srgb, var(--ogrid-fg, #242424) 6%, transparent);
  font-size: 12px;
  line-height: 1.2;
}
.ogrid-xtb-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--ogrid-radius-sm, 4px);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}
.ogrid-xtb-item[aria-pressed="true"] { font-weight: 600; }
.ogrid-xtb-item:hover, .ogrid-xtb-item:focus-visible { background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.05)); }
.ogrid-xtb-item .ogrid-xtb-check { width: 14px; flex: 0 0 14px; color: var(--ogrid-primary, #217346); }
.ogrid-xtb-item .ogrid-xtb-hint { margin-left: auto; padding-left: 16px; color: var(--ogrid-fg-muted, rgba(0, 0, 0, 0.45)); font-variant-numeric: tabular-nums; }
.ogrid-xtb-grid { display: grid; grid-template-columns: repeat(10, 18px); gap: 4px; padding: 4px 2px; }
.ogrid-xtb-grid.ogrid-xtb-std { margin-top: 2px; padding-top: 8px; border-top: 1px solid var(--ogrid-border, #e0e0e0); }
.ogrid-xtb-swatch {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ogrid-fg, #242424) 18%, transparent);
  transition: transform 80ms ease;
}
.ogrid-xtb-swatch:hover { transform: scale(1.18); }
.ogrid-xtb-swatch[aria-pressed="true"] {
  outline: 2px solid var(--ogrid-primary, #217346);
  outline-offset: 1px;
}
.ogrid-xtb-label { padding: 6px 4px 2px; color: var(--ogrid-fg-muted, rgba(0, 0, 0, 0.45)); font-size: 11px; }
.ogrid-xtb-custom { position: relative; }
.ogrid-xtb-custom input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: 0;
  padding: 0;
}
.ogrid-xtb-font { min-width: 116px; justify-content: space-between; padding: 0 4px 0 6px; }
.ogrid-xtb-font .ogrid-xtb-chevron { opacity: 0.6; }
.ogrid-xtb-font-name {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 96px;
  white-space: nowrap;
}
.ogrid-xtb-font-pop { max-height: 320px; overflow-y: auto; min-width: 160px; }
.ogrid-xtb-size { min-width: 56px; justify-content: space-between; padding: 0 4px 0 8px; }
.ogrid-xtb-size .ogrid-xtb-chevron { opacity: 0.6; }
.ogrid-xtb-font-size { font-variant-numeric: tabular-nums; }
.ogrid-xtb-size-pop { min-width: 120px; }
.ogrid-xtb-size-row { display: flex; gap: 4px; padding: 2px 2px 6px; }
.ogrid-xtb-size-input {
  width: 64px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--ogrid-border, #e0e0e0);
  border-radius: var(--ogrid-radius-sm, 4px);
  background: var(--ogrid-bg, #fff);
  color: inherit;
  font: inherit;
  font-variant-numeric: tabular-nums;
}
.ogrid-xtb-size-apply {
  flex: 1 1 auto;
  height: 28px;
  border: 0;
  border-radius: var(--ogrid-radius-sm, 4px);
  background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.05));
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.ogrid-xtb-size-apply:hover { background: var(--ogrid-active-bg, rgba(0, 0, 0, 0.08)); }
.ogrid-xtb-size-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; max-height: 220px; overflow-y: auto; }
.ogrid-xtb-border-pop { min-width: 208px; }
.ogrid-xtb-border-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 2px 2px 6px; }
.ogrid-xtb-border-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--ogrid-border, #e0e0e0);
  border-radius: var(--ogrid-radius-sm, 4px);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.ogrid-xtb-border-btn:hover { background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.05)); }
.ogrid-xtb-border-field { justify-content: space-between; gap: 8px; }
.ogrid-xtb-select {
  height: 24px;
  padding: 0 4px;
  border: 1px solid var(--ogrid-border, #e0e0e0);
  border-radius: 3px;
  background: var(--ogrid-bg, #fff);
  color: inherit;
  font: inherit;
}
.ogrid-xtb-border-field.ogrid-xtb-custom { position: relative; }
.ogrid-xtb-border-field.ogrid-xtb-custom input[type="color"] {
  position: static;
  width: 40px;
  height: 22px;
  opacity: 1;
  padding: 0;
}
`;
