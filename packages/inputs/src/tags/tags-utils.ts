/** Tags/chip utility functions  -  zero dependencies. */

/**
 * Default tag colors  -  soft pastels that work in light and dark modes.
 */
export const DEFAULT_TAG_COLORS: readonly string[] = [
  '#E3F2FD', '#FCE4EC', '#E8F5E9', '#FFF3E0', '#F3E5F5',
  '#E0F7FA', '#FFF8E1', '#EDE7F6', '#E8EAF6', '#FFEBEE',
] as const;

/**
 * Parse a value into an array of tag strings.
 * Handles: string (comma-separated), string[], null/undefined.
 */
export function parseTags(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const str = String(value).trim();
  if (!str) return [];
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Format tag array back to a comma-separated string.
 */
export function formatTags(tags: string[]): string {
  return tags.join(', ');
}

/**
 * Get a deterministic color for a tag based on its text content.
 * Uses a simple hash to pick from the color palette.
 */
export function getTagColor(tag: string, colors: readonly string[] = DEFAULT_TAG_COLORS): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash + tag.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length] ?? DEFAULT_TAG_COLORS[0] ?? '#e2e8f0';
}

/**
 * Filter tags by a search query (case-insensitive).
 */
export function filterTagSuggestions(query: string, allTags: readonly string[], selectedTags: string[]): string[] {
  const q = query.toLowerCase().trim();
  const selectedSet = new Set(selectedTags);
  return allTags.filter((t) => !selectedSet.has(t) && t.toLowerCase().includes(q));
}
