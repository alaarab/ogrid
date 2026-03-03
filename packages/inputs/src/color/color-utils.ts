/** Color picker utility functions — zero dependencies. */

/**
 * Default color palette — 20 commonly used colors arranged in a 5×4 grid.
 */
export const DEFAULT_COLOR_PALETTE: readonly string[] = [
  '#FF6B6B', '#FF8E72', '#FFC078', '#FFD93D', '#6BCB77',
  '#4D96FF', '#6C5CE7', '#A66DD4', '#FD79A8', '#FDCB6E',
  '#00B894', '#00CEC9', '#0984E3', '#6C5CE7', '#E17055',
  '#DFE6E9', '#B2BEC3', '#636E72', '#2D3436', '#FFFFFF',
] as const;

/**
 * Validate a hex color string (3, 4, 6, or 8 hex digits with optional #).
 */
export function isValidHex(hex: string): boolean {
  return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(hex.trim());
}

/**
 * Normalize a hex color to #RRGGBB format.
 * Returns null if invalid.
 */
export function normalizeHex(hex: string): string | null {
  const trimmed = hex.trim().replace(/^#/, '');
  if (!isValidHex(trimmed)) return null;

  if (trimmed.length === 3) {
    return '#' + trimmed[0] + trimmed[0] + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2];
  }
  if (trimmed.length === 4) {
    return '#' + trimmed[0] + trimmed[0] + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2];
  }
  if (trimmed.length === 8) {
    return '#' + trimmed.slice(0, 6);
  }
  return '#' + trimmed.toUpperCase();
}

/**
 * Parse a hex color into RGB components. Returns null if invalid.
 */
export function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const h = normalized.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Determine if a color is light (for choosing text contrast).
 */
export function isLightColor(hex: string): boolean {
  const rgb = parseHexColor(hex);
  if (!rgb) return true;
  // YIQ formula
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 128;
}
