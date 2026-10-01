/** Slider utility functions  -  zero dependencies. */

export const DEFAULT_MIN = 0;
export const DEFAULT_MAX = 100;
export const DEFAULT_STEP = 1;

/**
 * Clamp a value to [min, max].
 */
export function clampValue(value: number, min: number = DEFAULT_MIN, max: number = DEFAULT_MAX): number {
  return Math.max(min, Math.min(max, value));
}

/** Number of decimal places in a number's string form (0 for integers). */
function decimalPlaces(value: number): number {
  const str = String(value);
  const dot = str.indexOf('.');
  return dot === -1 ? 0 : str.length - dot - 1;
}

/**
 * Snap a value to the nearest step increment from min.
 */
export function snapToStep(value: number, min: number = DEFAULT_MIN, step: number = DEFAULT_STEP): number {
  if (step <= 0) return value;
  const snapped = min + Math.round((value - min) / step) * step;
  // Fractional steps (0.1, 0.3, …) leak float noise such as
  // 0.30000000000000004 into the value; round to the step/min precision.
  const precision = Math.max(decimalPlaces(step), decimalPlaces(min));
  return precision === 0 ? snapped : Number(snapped.toFixed(precision));
}

/**
 * Get the percentage position of a value within [min, max]. Returns 0–100.
 */
export function getPercentage(value: number, min: number = DEFAULT_MIN, max: number = DEFAULT_MAX): number {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

/**
 * Convert a pixel offset on a track element to a value in [min, max].
 */
export function getValueFromOffset(
  offsetX: number,
  trackWidth: number,
  min: number = DEFAULT_MIN,
  max: number = DEFAULT_MAX,
  step: number = DEFAULT_STEP,
): number {
  // A zero-width track (hidden element) would divide by zero and yield NaN.
  if (!(trackWidth > 0)) return min;
  const ratio = Math.max(0, Math.min(1, offsetX / trackWidth));
  const raw = min + ratio * (max - min);
  return clampValue(snapToStep(raw, min, step), min, max);
}
