/** Time picker utility functions  -  zero dependencies. */

export type AmPm = 'AM' | 'PM';

export interface TimeValue {
  hours: number;   // 0-23
  minutes: number; // 0-59
}

/**
 * Parse a time string into a TimeValue.
 * Accepts:
 *   - "HH:MM" (24-hour)
 *   - "H:MM AM/PM" or "H:MM am/pm" (12-hour)
 * Returns null if invalid.
 */
export function parseTime(str: string): TimeValue | null {
  if (!str) return null;
  const trimmed = str.trim();

  // Try 12-hour format: "h:mm AM" or "h:mm PM"
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12?.[1] != null && match12[2] != null && match12[3] != null) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const ampm = match12[3].toUpperCase() as AmPm;
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (ampm === 'AM') {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
    return { hours, minutes };
  }

  // Try 24-hour format: "HH:MM"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24?.[1] != null && match24[2] != null) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
  }

  return null;
}

/**
 * Format a TimeValue as a 12-hour US time string (e.g., "2:30 PM").
 */
export function formatTime12(time: TimeValue): string {
  const { hours, minutes } = time;
  const ampm: AmPm = hours < 12 ? 'AM' : 'PM';
  const h = hours % 12 === 0 ? 12 : hours % 12;
  const m = String(minutes).padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

/**
 * Format a TimeValue as a 24-hour time string (e.g., "14:30").
 */
export function formatTime24(time: TimeValue): string {
  const h = String(time.hours).padStart(2, '0');
  const m = String(time.minutes).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Get 12-hour display value (1-12) from 24-hour hours.
 */
export function toHour12(hours: number): number {
  return hours % 12 === 0 ? 12 : hours % 12;
}

/**
 * Get AM/PM from 24-hour hours.
 */
export function toAmPm(hours: number): AmPm {
  return hours < 12 ? 'AM' : 'PM';
}

/**
 * Convert 12-hour + AM/PM to 24-hour.
 */
export function fromHour12(hour12: number, ampm: AmPm): number {
  if (ampm === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

/**
 * Clamp a number within min/max (inclusive).
 */
export function clampTime(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate minute options at a given interval (default 5).
 */
export function getMinuteOptions(step = 5): number[] {
  const options: number[] = [];
  for (let m = 0; m < 60; m += step) {
    options.push(m);
  }
  return options;
}

/**
 * Generate 12-hour hour options (1-12).
 */
export function getHour12Options(): number[] {
  return [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
}
