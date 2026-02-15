/**
 * Edge case tests for getCellValue utility.
 * Covers nested paths, null/undefined handling, type conversions, array indexing.
 */
import { getCellValue } from '../cellValue';
import type { IColumnDef } from '../../types/columnTypes';

describe('getCellValue - Edge Cases', () => {
  describe('Nested object paths', () => {
    interface User {
      id: string;
      profile: {
        name: string;
        address: {
          city: string;
          country: string;
        } | null;
      } | null;
      tags: string[];
    }

    it('should handle nested path when all levels exist', () => {
      const user: User = {
        id: '1',
        profile: {
          name: 'Alice',
          address: { city: 'NYC', country: 'USA' },
        },
        tags: ['admin', 'user'],
      };

      const col: IColumnDef<User> = {
        columnId: 'city',
        name: 'City',
        valueGetter: (u) => u.profile?.address?.city,
      };

      expect(getCellValue(user, col)).toBe('NYC');
    });

    it('should return undefined when nested path does not exist (null intermediate)', () => {
      const user: User = {
        id: '1',
        profile: {
          name: 'Bob',
          address: null, // address is null
        },
        tags: [],
      };

      const col: IColumnDef<User> = {
        columnId: 'city',
        name: 'City',
        valueGetter: (u) => u.profile?.address?.city,
      };

      expect(getCellValue(user, col)).toBeUndefined();
    });

    it('should return undefined when top-level nested object is null', () => {
      const user: User = {
        id: '1',
        profile: null, // entire profile is null
        tags: [],
      };

      const col: IColumnDef<User> = {
        columnId: 'name',
        name: 'Name',
        valueGetter: (u) => u.profile?.name,
      };

      expect(getCellValue(user, col)).toBeUndefined();
    });

    it('should handle array indexing in valueGetter', () => {
      const user: User = {
        id: '1',
        profile: { name: 'Charlie', address: null },
        tags: ['admin', 'moderator'],
      };

      const col: IColumnDef<User> = {
        columnId: 'firstTag',
        name: 'First Tag',
        valueGetter: (u) => u.tags[0],
      };

      expect(getCellValue(user, col)).toBe('admin');
    });

    it('should return undefined for out-of-bounds array index', () => {
      const user: User = {
        id: '1',
        profile: { name: 'Dave', address: null },
        tags: ['admin'],
      };

      const col: IColumnDef<User> = {
        columnId: 'thirdTag',
        name: 'Third Tag',
        valueGetter: (u) => u.tags[2], // Index 2 doesn't exist
      };

      expect(getCellValue(user, col)).toBeUndefined();
    });

    it('should handle empty array access', () => {
      const user: User = {
        id: '1',
        profile: { name: 'Eve', address: null },
        tags: [],
      };

      const col: IColumnDef<User> = {
        columnId: 'firstTag',
        name: 'First Tag',
        valueGetter: (u) => u.tags[0],
      };

      expect(getCellValue(user, col)).toBeUndefined();
    });
  });

  describe('Null and undefined handling', () => {
    interface Product {
      id: string;
      name: string | null;
      price: number | null | undefined;
      inStock: boolean | null;
      releaseDate: Date | null;
    }

    it('should return null when property value is explicitly null', () => {
      const product: Product = {
        id: '1',
        name: null,
        price: 100,
        inStock: true,
        releaseDate: null,
      };

      const col: IColumnDef<Product> = {
        columnId: 'name',
        name: 'Name',
      };

      expect(getCellValue(product, col)).toBeNull();
    });

    it('should return undefined when property value is explicitly undefined', () => {
      const product: Product = {
        id: '1',
        name: 'Widget',
        price: undefined,
        inStock: true,
        releaseDate: null,
      };

      const col: IColumnDef<Product> = {
        columnId: 'price',
        name: 'Price',
      };

      expect(getCellValue(product, col)).toBeUndefined();
    });

    it('should return null for null boolean value', () => {
      const product: Product = {
        id: '1',
        name: 'Gadget',
        price: 50,
        inStock: null,
        releaseDate: null,
      };

      const col: IColumnDef<Product> = {
        columnId: 'inStock',
        name: 'In Stock',
      };

      expect(getCellValue(product, col)).toBeNull();
    });

    it('should return null for null Date value', () => {
      const product: Product = {
        id: '1',
        name: 'Tool',
        price: 75,
        inStock: true,
        releaseDate: null,
      };

      const col: IColumnDef<Product> = {
        columnId: 'releaseDate',
        name: 'Release Date',
      };

      expect(getCellValue(product, col)).toBeNull();
    });

    it('should handle valueGetter returning null', () => {
      const product: Product = {
        id: '1',
        name: 'Item',
        price: null,
        inStock: true,
        releaseDate: null,
      };

      const col: IColumnDef<Product> = {
        columnId: 'discountedPrice',
        name: 'Discounted Price',
        valueGetter: (p) => (p.price !== null && p.price !== undefined ? p.price * 0.9 : null),
      };

      expect(getCellValue(product, col)).toBeNull();
    });

    it('should handle valueGetter returning undefined', () => {
      const product: Product = {
        id: '1',
        name: 'Item',
        price: 100,
        inStock: true,
        releaseDate: null,
      };

      const col: IColumnDef<Product> = {
        columnId: 'optional',
        name: 'Optional',
        valueGetter: () => undefined,
      };

      expect(getCellValue(product, col)).toBeUndefined();
    });
  });

  describe('Type conversions and special values', () => {
    interface Data {
      id: string;
      count: number;
      flag: boolean;
      timestamp: Date;
      emptyString: string;
      zeroValue: number;
      falseValue: boolean;
    }

    it('should return zero (not treat as falsy)', () => {
      const data: Data = {
        id: '1',
        count: 10,
        flag: true,
        timestamp: new Date(),
        emptyString: '',
        zeroValue: 0,
        falseValue: false,
      };

      const col: IColumnDef<Data> = {
        columnId: 'zeroValue',
        name: 'Zero',
      };

      expect(getCellValue(data, col)).toBe(0);
    });

    it('should return false boolean (not treat as falsy)', () => {
      const data: Data = {
        id: '1',
        count: 10,
        flag: true,
        timestamp: new Date(),
        emptyString: '',
        zeroValue: 0,
        falseValue: false,
      };

      const col: IColumnDef<Data> = {
        columnId: 'falseValue',
        name: 'False',
      };

      expect(getCellValue(data, col)).toBe(false);
    });

    it('should return empty string (not treat as falsy)', () => {
      const data: Data = {
        id: '1',
        count: 10,
        flag: true,
        timestamp: new Date(),
        emptyString: '',
        zeroValue: 0,
        falseValue: false,
      };

      const col: IColumnDef<Data> = {
        columnId: 'emptyString',
        name: 'Empty',
      };

      expect(getCellValue(data, col)).toBe('');
    });

    it('should return Date object', () => {
      const date = new Date('2024-01-15');
      const data: Data = {
        id: '1',
        count: 10,
        flag: true,
        timestamp: date,
        emptyString: '',
        zeroValue: 0,
        falseValue: false,
      };

      const col: IColumnDef<Data> = {
        columnId: 'timestamp',
        name: 'Timestamp',
      };

      expect(getCellValue(data, col)).toBe(date);
    });

    it('should handle negative numbers', () => {
      const data = {
        id: '1',
        balance: -100,
      };

      const col: IColumnDef<typeof data> = {
        columnId: 'balance',
        name: 'Balance',
      };

      expect(getCellValue(data, col)).toBe(-100);
    });

    it('should handle NaN', () => {
      const data = {
        id: '1',
        result: NaN,
      };

      const col: IColumnDef<typeof data> = {
        columnId: 'result',
        name: 'Result',
      };

      expect(getCellValue(data, col)).toBeNaN();
    });

    it('should handle Infinity', () => {
      const data = {
        id: '1',
        max: Infinity,
      };

      const col: IColumnDef<typeof data> = {
        columnId: 'max',
        name: 'Max',
      };

      expect(getCellValue(data, col)).toBe(Infinity);
    });
  });

  describe('ValueGetter edge cases', () => {
    interface Item {
      id: string;
      value: number;
    }

    it('should handle valueGetter that throws error (error propagates)', () => {
      const item: Item = { id: '1', value: 10 };

      const col: IColumnDef<Item> = {
        columnId: 'computed',
        name: 'Computed',
        valueGetter: () => {
          throw new Error('Computation failed');
        },
      };

      expect(() => getCellValue(item, col)).toThrow('Computation failed');
    });

    it('should handle valueGetter with complex computation', () => {
      const item: Item = { id: '1', value: 10 };

      const col: IColumnDef<Item> = {
        columnId: 'factorial',
        name: 'Factorial',
        valueGetter: (i) => {
          let result = 1;
          for (let n = 2; n <= i.value; n++) {
            result *= n;
          }
          return result;
        },
      };

      expect(getCellValue(item, col)).toBe(3628800); // 10!
    });

    it('should handle valueGetter returning object', () => {
      const item: Item = { id: '1', value: 10 };

      const col: IColumnDef<Item> = {
        columnId: 'metadata',
        name: 'Metadata',
        valueGetter: (i) => ({ doubled: i.value * 2, tripled: i.value * 3 }),
      };

      expect(getCellValue(item, col)).toEqual({ doubled: 20, tripled: 30 });
    });

    it('should handle valueGetter returning array', () => {
      const item: Item = { id: '1', value: 3 };

      const col: IColumnDef<Item> = {
        columnId: 'range',
        name: 'Range',
        valueGetter: (i) => Array.from({ length: i.value }, (_, idx) => idx),
      };

      expect(getCellValue(item, col)).toEqual([0, 1, 2]);
    });
  });

  describe('Direct property access edge cases', () => {
    it('should return undefined for non-existent property', () => {
      const item = { id: '1', name: 'Test' };

      const col: IColumnDef<typeof item> = {
        columnId: 'missing' as keyof typeof item,
        name: 'Missing',
      };

      expect(getCellValue(item, col)).toBeUndefined();
    });

    it('should handle property with special characters in key', () => {
      const item = {
        id: '1',
        'special-key': 'value',
      };

      const col: IColumnDef<typeof item> = {
        columnId: 'special-key' as keyof typeof item,
        name: 'Special',
      };

      expect(getCellValue(item, col)).toBe('value');
    });

    it('should handle numeric property keys', () => {
      const item = {
        id: '1',
        '123': 'numeric key',
      };

      const col: IColumnDef<typeof item> = {
        columnId: '123' as keyof typeof item,
        name: 'Numeric',
      };

      expect(getCellValue(item, col)).toBe('numeric key');
    });
  });
});
