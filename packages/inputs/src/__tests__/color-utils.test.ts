import {
  isValidHex,
  normalizeHex,
  parseHexColor,
  isLightColor,
} from '../color/color-utils';

describe('color-utils', () => {
  describe('isValidHex', () => {
    it('accepts valid 6-digit hex with #', () => {
      expect(isValidHex('#FF0000')).toBe(true);
      expect(isValidHex('#000000')).toBe(true);
      expect(isValidHex('#FFFFFF')).toBe(true);
      expect(isValidHex('#abc123')).toBe(true);
    });

    it('accepts valid 3-digit hex with #', () => {
      expect(isValidHex('#FFF')).toBe(true);
      expect(isValidHex('#000')).toBe(true);
      expect(isValidHex('#abc')).toBe(true);
    });

    it('accepts valid 8-digit hex with # (alpha)', () => {
      expect(isValidHex('#FF000080')).toBe(true);
      expect(isValidHex('#FFFFFFFF')).toBe(true);
    });

    it('accepts hex without # prefix', () => {
      expect(isValidHex('FF0000')).toBe(true);
      expect(isValidHex('FFF')).toBe(true);
    });

    it('rejects invalid strings', () => {
      expect(isValidHex('')).toBe(false);
      expect(isValidHex('not-a-hex')).toBe(false);
      expect(isValidHex('#GGG')).toBe(false);
      expect(isValidHex('#12345')).toBe(false); // 5 digits
      expect(isValidHex('#1234567')).toBe(false); // 7 digits
    });

    it('rejects strings with invalid characters', () => {
      expect(isValidHex('#GGGGGG')).toBe(false);
      expect(isValidHex('#FF GG 00')).toBe(false);
    });
  });

  describe('normalizeHex', () => {
    it('expands 3-digit hex to 6-digit', () => {
      expect(normalizeHex('#FFF')).toBe('#FFFFFF');
      expect(normalizeHex('#000')).toBe('#000000');
      // 3-digit expansion preserves original case (not uppercased)
      expect(normalizeHex('#abc')).toBe('#aabbcc');
    });

    it('also expands 3-digit hex without # prefix', () => {
      expect(normalizeHex('FFF')).toBe('#FFFFFF');
      expect(normalizeHex('abc')).toBe('#aabbcc');
    });

    it('returns uppercase 6-digit hex for valid 6-digit input', () => {
      expect(normalizeHex('#ff0000')).toBe('#FF0000');
      expect(normalizeHex('#00FF00')).toBe('#00FF00');
    });

    it('extracts first 6 digits from 8-digit hex (strips alpha)', () => {
      expect(normalizeHex('#FF000080')).toBe('#FF0000');
      expect(normalizeHex('#FFFFFFFF')).toBe('#FFFFFF');
    });

    it('returns null for invalid hex strings', () => {
      expect(normalizeHex('')).toBeNull();
      expect(normalizeHex('not-a-color')).toBeNull();
      expect(normalizeHex('#GGGGGG')).toBeNull();
    });

    it('handles whitespace trimming', () => {
      // 3-digit expansion preserves case; uppercase input produces uppercase output
      expect(normalizeHex('  #FFF  ')).toBe('#FFFFFF');
      expect(normalizeHex('  #fff  ')).toBe('#ffffff');
    });
  });

  describe('parseHexColor', () => {
    it('parses a valid 6-digit hex into RGB components', () => {
      expect(parseHexColor('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseHexColor('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(parseHexColor('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
      expect(parseHexColor('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseHexColor('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('parses 3-digit hex by expanding first', () => {
      expect(parseHexColor('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseHexColor('#000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseHexColor('#F00')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('returns null for invalid hex', () => {
      expect(parseHexColor('')).toBeNull();
      expect(parseHexColor('not-a-color')).toBeNull();
      expect(parseHexColor('#GGGGGG')).toBeNull();
    });

    it('returns correct values for mid-range colors', () => {
      const result = parseHexColor('#7F7F7F');
      expect(result).not.toBeNull();
      expect(result!.r).toBe(127);
      expect(result!.g).toBe(127);
      expect(result!.b).toBe(127);
    });
  });

  describe('isLightColor', () => {
    it('returns true for white (#FFFFFF)', () => {
      expect(isLightColor('#FFFFFF')).toBe(true);
    });

    it('returns false for black (#000000)', () => {
      expect(isLightColor('#000000')).toBe(false);
    });

    it('returns true for yellow (light color)', () => {
      expect(isLightColor('#FFFF00')).toBe(true);
      expect(isLightColor('#FFD700')).toBe(true);
    });

    it('returns false for dark colors', () => {
      expect(isLightColor('#1A1A1A')).toBe(false);
      expect(isLightColor('#222222')).toBe(false);
      expect(isLightColor('#003366')).toBe(false);
    });

    it('returns true for invalid hex (safe default)', () => {
      expect(isLightColor('invalid')).toBe(true);
      expect(isLightColor('')).toBe(true);
    });

    it('returns true for light blue/gray tones', () => {
      expect(isLightColor('#E3F2FD')).toBe(true); // very light blue
      expect(isLightColor('#F5F5F5')).toBe(true); // near-white gray
    });
  });
});
