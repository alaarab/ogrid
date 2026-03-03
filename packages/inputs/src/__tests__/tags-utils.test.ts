import {
  parseTags,
  formatTags,
  getTagColor,
  filterTagSuggestions,
  DEFAULT_TAG_COLORS,
} from '../tags/tags-utils';

describe('tags-utils', () => {
  describe('parseTags', () => {
    it('parses a comma-separated string into an array', () => {
      expect(parseTags('Bug, Feature, Docs')).toEqual(['Bug', 'Feature', 'Docs']);
      expect(parseTags('one,two,three')).toEqual(['one', 'two', 'three']);
    });

    it('trims whitespace from each tag', () => {
      expect(parseTags('  Bug  ,  Feature  ')).toEqual(['Bug', 'Feature']);
    });

    it('passes through a string array unchanged', () => {
      expect(parseTags(['Bug', 'Feature'])).toEqual(['Bug', 'Feature']);
    });

    it('filters empty strings from arrays', () => {
      expect(parseTags(['Bug', '', 'Feature'])).toEqual(['Bug', 'Feature']);
    });

    it('returns empty array for null', () => {
      expect(parseTags(null)).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(parseTags(undefined)).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      expect(parseTags('')).toEqual([]);
    });

    it('handles single tag string with no comma', () => {
      expect(parseTags('Bug')).toEqual(['Bug']);
    });

    it('converts non-string array elements to strings', () => {
      expect(parseTags([1, 2, 3] as unknown as string[])).toEqual(['1', '2', '3']);
    });
  });

  describe('formatTags', () => {
    it('joins tags into a comma-space-separated string', () => {
      expect(formatTags(['Bug', 'Feature', 'Docs'])).toBe('Bug, Feature, Docs');
    });

    it('returns empty string for empty array', () => {
      expect(formatTags([])).toBe('');
    });

    it('returns single tag without trailing separator', () => {
      expect(formatTags(['Bug'])).toBe('Bug');
    });

    it('round-trips with parseTags', () => {
      const tags = ['Alpha', 'Beta', 'Gamma'];
      expect(parseTags(formatTags(tags))).toEqual(tags);
    });
  });

  describe('getTagColor', () => {
    it('returns a color string from the palette', () => {
      const color = getTagColor('Bug');
      expect(DEFAULT_TAG_COLORS).toContain(color);
    });

    it('is deterministic  -  same tag always returns same color', () => {
      const color1 = getTagColor('Bug');
      const color2 = getTagColor('Bug');
      const color3 = getTagColor('Bug');
      expect(color1).toBe(color2);
      expect(color2).toBe(color3);
    });

    it('different tags may return different colors', () => {
      const colors = new Set([
        getTagColor('Alpha'),
        getTagColor('Beta'),
        getTagColor('Gamma'),
        getTagColor('Delta'),
        getTagColor('Epsilon'),
        getTagColor('Zeta'),
        getTagColor('Eta'),
        getTagColor('Theta'),
        getTagColor('Iota'),
        getTagColor('Kappa'),
      ]);
      // With 10 colors in palette and 10 different tags, we expect at least 2 distinct colors
      expect(colors.size).toBeGreaterThan(1);
    });

    it('accepts custom color palette', () => {
      const customColors = ['#FF0000', '#00FF00', '#0000FF'];
      const color = getTagColor('Bug', customColors);
      expect(customColors).toContain(color);
    });

    it('returns the same color for the same tag with a custom palette', () => {
      const customColors = ['#FF0000', '#00FF00', '#0000FF'];
      expect(getTagColor('Feature', customColors)).toBe(getTagColor('Feature', customColors));
    });
  });

  describe('filterTagSuggestions', () => {
    const allTags = ['Bug', 'Feature', 'Documentation', 'Enhancement', 'Help Wanted'];

    it('filters suggestions matching the query (case-insensitive)', () => {
      expect(filterTagSuggestions('bug', allTags, [])).toEqual(['Bug']);
      expect(filterTagSuggestions('BUG', allTags, [])).toEqual(['Bug']);
      // "ment" appears in both "Documentation" (docu*ment*ation) and "Enhancement" (enhance*ment*)
      const mentMatches = filterTagSuggestions('ment', allTags, []);
      expect(mentMatches).toContain('Enhancement');
      expect(mentMatches).toContain('Documentation');
    });

    it('excludes already-selected tags', () => {
      expect(filterTagSuggestions('', allTags, ['Bug', 'Feature'])).not.toContain('Bug');
      expect(filterTagSuggestions('', allTags, ['Bug', 'Feature'])).not.toContain('Feature');
    });

    it('returns all unselected tags when query is empty', () => {
      const result = filterTagSuggestions('', allTags, []);
      expect(result).toEqual(allTags);
    });

    it('returns empty array when no tags match', () => {
      expect(filterTagSuggestions('xyz', allTags, [])).toEqual([]);
    });

    it('returns empty array when all matching tags are selected', () => {
      expect(filterTagSuggestions('bug', allTags, ['Bug'])).toEqual([]);
    });

    it('handles partial matches in the middle of tag names', () => {
      expect(filterTagSuggestions('doc', allTags, [])).toEqual(['Documentation']);
      expect(filterTagSuggestions('help', allTags, [])).toEqual(['Help Wanted']);
    });

    it('handles empty allTags array', () => {
      expect(filterTagSuggestions('bug', [], [])).toEqual([]);
    });

    it('handles whitespace in query (trims before matching)', () => {
      expect(filterTagSuggestions('  bug  ', allTags, [])).toEqual(['Bug']);
    });
  });
});
