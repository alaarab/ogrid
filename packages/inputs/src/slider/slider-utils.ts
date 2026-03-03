/** Slider utility functions — zero dependencies. */

export const DEFAULT_MIN = 0;
export const DEFAULT_MAX = 100;
export const DEFAULT_STEP = 1;

/**
 * Clamp a value to [min, max].
 */
export function clampValue(value: number, min: number = DEFAULT_MIN, max: number = DEFAULT_MAX): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Snap a value to the nearest step increment from min.
 */
export function snapToStep(value: number, min: number = DEFAULT_MIN, step: number = DEFAULT_STEP): number {
  if (step <= 0) return value;
  return min + Math.round((value - min) / step) * step;
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
  const ratio = Math.max(0, Math.min(1, offsetX / trackWidth));
  const raw = min + ratio * (max - min);
  return clampValue(snapToStep(raw, min, step), min, max);
}
