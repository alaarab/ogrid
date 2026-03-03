/** Rating utility functions  -  zero dependencies. */

export const DEFAULT_MAX_STARS = 5;

export type StarFill = 'full' | 'half' | 'empty';

/**
 * Clamp a rating value to [0, maxStars].
 */
export function clampRating(value: number, maxStars: number = DEFAULT_MAX_STARS): number {
  return Math.max(0, Math.min(maxStars, value));
}

/**
 * Determine the fill state for a given star index (0-based).
 * - `full` if the rating is >= starIndex + 1
 * - `half` if allowHalf and rating is >= starIndex + 0.5 but < starIndex + 1
 * - `empty` otherwise
 */
export function getStarFill(starIndex: number, rating: number, allowHalf: boolean = false): StarFill {
  if (rating >= starIndex + 1) return 'full';
  if (allowHalf && rating >= starIndex + 0.5) return 'half';
  return 'empty';
}

/**
 * Convert a click position within a star to a rating value.
 * If allowHalf, left half = starIndex + 0.5, right half = starIndex + 1.
 * Otherwise always starIndex + 1.
 */
export function getRatingFromPosition(
  starIndex: number,
  offsetX: number,
  starWidth: number,
  allowHalf: boolean = false,
): number {
  if (allowHalf && offsetX < starWidth / 2) {
    return starIndex + 0.5;
  }
  return starIndex + 1;
}
