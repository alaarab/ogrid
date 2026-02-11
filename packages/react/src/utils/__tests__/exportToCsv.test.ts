import {
  escapeCsvValue,
  buildCsvHeader,
  buildCsvRows,
  exportToCsv,
  triggerCsvDownload,
  type CsvColumn,
} from '../exportToCsv';

describe('exportToCsv', () => {
  describe('escapeCsvValue', () => {
    it('returns empty string for null and undefined', () => {
      expect(escapeCsvValue(null)).toBe('');
      expect(escapeCsvValue(undefined)).toBe('');
    });

    it('returns string as-is when no special characters', () => {
      expect(escapeCsvValue('plain')).toBe('plain');
      expect(escapeCsvValue('123')).toBe('123');
    });

    it('wraps in quotes and doubles internal quotes when value contains comma', () => {
      expect(escapeCsvValue('a,b')).toBe('"a,b"');
    });

    it('wraps in quotes and doubles internal quotes when value contains double quote', () => {
      expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    });

    it('wraps in quotes when value contains newline', () => {
      expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
    });

    it('handles combined special characters', () => {
      expect(escapeCsvValue('a,b"c\nd')).toBe('"a,b""c\nd"');
    });

    it('converts numbers to string', () => {
      expect(escapeCsvValue(42)).toBe('42');
    });
  });

  describe('buildCsvHeader', () => {
    it('joins column names with comma', () => {
      const columns: CsvColumn[] = [
        { columnId: 'a', name: 'Col A' },
        { columnId: 'b', name: 'Col B' },
      ];
      expect(buildCsvHeader(columns)).toBe('Col A,Col B');
    });

    it('escapes column names with special characters', () => {
      const columns: CsvColumn[] = [
        { columnId: 'a', name: 'Name, Title' },
        { columnId: 'b', name: 'Count' },
      ];
      expect(buildCsvHeader(columns)).toBe('"Name, Title",Count');
    });
  });

  describe('buildCsvRows', () => {
    it('builds one row per item using getValue', () => {
      const columns: CsvColumn[] = [
        { columnId: 'id', name: 'ID' },
        { columnId: 'name', name: 'Name' },
      ];
      const items = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
      const getValue = (item: { id: number; name: string }, col: string): string =>
        col === 'id' ? String(item.id) : item.name;
      const rows = buildCsvRows(items, columns, getValue);
      expect(rows).toEqual(['1,Alice', '2,Bob']);
    });

    it('escapes values from getValue', () => {
      const columns: CsvColumn[] = [{ columnId: 'x', name: 'X' }];
      const items = [{ x: 'a,b' }];
      const getValue = (item: { x: string }): string => item.x;
      const rows = buildCsvRows(items, columns, getValue);
      expect(rows).toEqual(['"a,b"']);
    });

    it('returns empty array when no items', () => {
      const columns: CsvColumn[] = [{ columnId: 'a', name: 'A' }];
      expect(buildCsvRows([], columns, (): string => '')).toEqual([]);
    });

    it('handles getValue returning empty string for null/undefined', () => {
      const columns: CsvColumn[] = [
        { columnId: 'a', name: 'A' },
        { columnId: 'b', name: 'B' },
      ];
      const items = [{ a: 'x', b: null }, { a: undefined, b: 'y' }];
      const getValue = (item: { a?: string; b?: string | null }, col: string): string => {
        const v = col === 'a' ? item.a : item.b;
        return v == null ? '' : String(v);
      };
      const rows = buildCsvRows(items, columns, getValue);
      expect(rows).toEqual(['x,', ',y']);
    });
  });

  describe('exportToCsv', () => {
    let capturedBlob: Blob;
    let mockLink: { setAttribute: jest.Mock; click: jest.Mock; style: Record<string, string> };

    beforeEach(() => {
      capturedBlob = null as unknown as Blob;
      mockLink = { setAttribute: jest.fn(), click: jest.fn(), style: {} };
      (global.URL.createObjectURL as jest.Mock) = jest.fn((b: Blob | MediaSource) => {
        capturedBlob = b as Blob;
        return 'blob:mock';
      });
      (global.URL.revokeObjectURL as jest.Mock) = jest.fn();
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLAnchorElement);
      jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as Node);
      jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as Node);
    });

    afterEach(() => {
      jest.restoreAllMocks();
      delete (URL as unknown as { revokeObjectURL?: (u: string) => void }).revokeObjectURL;
    });

    it('builds header + rows and triggers download with correct CSV content', async () => {
      const columns: CsvColumn[] = [
        { columnId: 'k', name: 'Key' },
        { columnId: 'v', name: 'Value' },
      ];
      const items = [{ k: 'x', v: '1' }];
      const getValue = (item: { k: string; v: string }, col: string): string => (col === 'k' ? item.k : item.v);

      exportToCsv(items, columns, getValue, 'out.csv');

      expect(capturedBlob).toBeTruthy();
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (): void => { resolve(reader.result as string); };
        reader.onerror = (): void => { reject(reader.error); };
        reader.readAsText(capturedBlob);
      });
      expect(text).toBe('Key,Value\nx,1');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'out.csv');
    });

    it('uses default filename when not provided', () => {
      exportToCsv([], [{ columnId: 'a', name: 'A' }], (): string => '', undefined);
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', expect.stringMatching(/^export_\d{4}-\d{2}-\d{2}\.csv$/));
    });
  });

  describe('triggerCsvDownload', () => {
    let createElement: jest.SpyInstance;
    let createObjectURL: jest.SpyInstance;
    let revokeObjectURL: jest.Mock;
    let appendChild: jest.SpyInstance;
    let removeChild: jest.SpyInstance;
    let mockLink: { setAttribute: jest.Mock; click: jest.Mock; style: Record<string, string> };

    beforeEach(() => {
      mockLink = {
        setAttribute: jest.fn(),
        click: jest.fn(),
        style: {},
      };
      createElement = jest.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLAnchorElement);
      (global.URL.createObjectURL as jest.Mock) = jest.fn().mockReturnValue('blob:mock');
      createObjectURL = global.URL.createObjectURL as jest.Mock;
      revokeObjectURL = jest.fn();
      (global.URL.revokeObjectURL as jest.Mock) = revokeObjectURL;
      appendChild = jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as Node);
      removeChild = jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as Node);
    });

    afterEach(() => {
      jest.restoreAllMocks();
      delete (URL as unknown as { revokeObjectURL?: (u: string) => void }).revokeObjectURL;
    });

    it('creates blob, link, sets href and download, appends, clicks, removes, revokes', () => {
      triggerCsvDownload('a,b\n1,2', 'test.csv');

      expect(createElement).toHaveBeenCalledWith('a');
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      const blob = (createObjectURL as jest.Mock).mock.calls[0][0];
      expect(blob.type).toBe('text/csv;charset=utf-8;');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'blob:mock');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'test.csv');
      expect(mockLink.style.visibility).toBe('hidden');
      expect(appendChild).toHaveBeenCalledWith(mockLink);
      expect(mockLink.click).toHaveBeenCalled();
      expect(removeChild).toHaveBeenCalledWith(mockLink);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    });
  });
});
