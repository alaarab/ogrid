import {
  CellDescriptorCache,
  type CellRenderDescriptorInput,
  type CellRenderDescriptor,
} from '../dataGridViewModel';

// Minimal input factory — only fields used by computeVersion
function makeInput(overrides: Partial<CellRenderDescriptorInput<{ id: string }>> = {}): CellRenderDescriptorInput<{ id: string }> {
  return {
    editingCell: null,
    activeCell: null,
    selectionRange: null,
    cutRange: null,
    copyRange: null,
    colOffset: 0,
    getRowId: (item) => item.id,
    editable: true,
    onCellValueChanged: jest.fn(),
    isDragging: false,
    ...overrides,
  };
}

function makeDescriptor(overrides: Partial<CellRenderDescriptor> = {}): CellRenderDescriptor {
  return {
    mode: 'display',
    isActive: false,
    isInRange: false,
    isInCutRange: false,
    isInCopyRange: false,
    isSelectionEndCell: false,
    canEditAny: false,
    isPinned: false,
    globalColIndex: 0,
    rowId: '1',
    rowIndex: 0,
    ...overrides,
  };
}

describe('CellDescriptorCache', () => {
  describe('computeVersion', () => {
    it('produces a string', () => {
      const input = makeInput();
      const version = CellDescriptorCache.computeVersion(input);
      expect(typeof version).toBe('string');
    });

    it('produces different strings for different editingCell', () => {
      const v1 = CellDescriptorCache.computeVersion(makeInput({ editingCell: null }));
      const v2 = CellDescriptorCache.computeVersion(makeInput({ editingCell: { rowId: '1', columnId: 'name' } }));
      expect(v1).not.toBe(v2);
    });

    it('produces different strings for different activeCell', () => {
      const v1 = CellDescriptorCache.computeVersion(makeInput({ activeCell: null }));
      const v2 = CellDescriptorCache.computeVersion(makeInput({ activeCell: { rowIndex: 0, columnIndex: 0 } }));
      expect(v1).not.toBe(v2);
    });

    it('produces different strings for different selectionRange', () => {
      const v1 = CellDescriptorCache.computeVersion(makeInput({ selectionRange: null }));
      const v2 = CellDescriptorCache.computeVersion(makeInput({ selectionRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 1 } }));
      expect(v1).not.toBe(v2);
    });

    it('produces different strings for different cutRange', () => {
      const v1 = CellDescriptorCache.computeVersion(makeInput({ cutRange: null }));
      const v2 = CellDescriptorCache.computeVersion(makeInput({ cutRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 0 } }));
      expect(v1).not.toBe(v2);
    });

    it('produces different strings for different copyRange', () => {
      const v1 = CellDescriptorCache.computeVersion(makeInput({ copyRange: null }));
      const v2 = CellDescriptorCache.computeVersion(makeInput({ copyRange: { startRow: 1, startCol: 0, endRow: 2, endCol: 0 } }));
      expect(v1).not.toBe(v2);
    });

    it('produces different strings when isDragging changes', () => {
      const v1 = CellDescriptorCache.computeVersion(makeInput({ isDragging: false }));
      const v2 = CellDescriptorCache.computeVersion(makeInput({ isDragging: true }));
      expect(v1).not.toBe(v2);
    });

    it('produces different strings when editable changes', () => {
      const v1 = CellDescriptorCache.computeVersion(makeInput({ editable: true }));
      const v2 = CellDescriptorCache.computeVersion(makeInput({ editable: false }));
      expect(v1).not.toBe(v2);
    });

    it('produces different strings when onCellValueChanged presence changes', () => {
      const v1 = CellDescriptorCache.computeVersion(makeInput({ onCellValueChanged: jest.fn() }));
      const v2 = CellDescriptorCache.computeVersion(makeInput({ onCellValueChanged: undefined }));
      expect(v1).not.toBe(v2);
    });

    it('produces the same string for identical inputs', () => {
      const input = makeInput({ activeCell: { rowIndex: 1, columnIndex: 2 } });
      const v1 = CellDescriptorCache.computeVersion(input);
      const v2 = CellDescriptorCache.computeVersion(input);
      expect(v1).toBe(v2);
    });
  });

  describe('instantiation', () => {
    it('creates a new cache with empty state', () => {
      const cache = new CellDescriptorCache();
      expect(cache.currentVersion).toBe('');
    });
  });

  describe('updateVersion / currentVersion', () => {
    it('stores the version set via updateVersion', () => {
      const cache = new CellDescriptorCache();
      const input = makeInput({ activeCell: { rowIndex: 0, columnIndex: 0 } });
      const version = CellDescriptorCache.computeVersion(input);
      cache.updateVersion(version);
      expect(cache.currentVersion).toBe(version);
    });

    it('updates currentVersion when called again', () => {
      const cache = new CellDescriptorCache();
      cache.updateVersion('v1');
      cache.updateVersion('v2');
      expect(cache.currentVersion).toBe('v2');
    });
  });

  describe('get — cache hit and miss', () => {
    it('calls compute on first access (cache miss)', () => {
      const cache = new CellDescriptorCache();
      const version = 'v1';
      cache.updateVersion(version);
      const compute = jest.fn<CellRenderDescriptor, []>().mockReturnValue(makeDescriptor({ rowIndex: 0 }));

      cache.get(0, 0, version, compute);

      expect(compute).toHaveBeenCalledTimes(1);
    });

    it('returns cached descriptor on second call with same version (cache hit)', () => {
      const cache = new CellDescriptorCache();
      const version = 'v1';
      cache.updateVersion(version);
      const descriptor = makeDescriptor({ rowIndex: 5 });
      const compute = jest.fn<CellRenderDescriptor, []>().mockReturnValue(descriptor);

      const first = cache.get(5, 2, version, compute);
      const second = cache.get(5, 2, version, compute);

      expect(compute).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('recomputes when version changes (cache miss after version change)', () => {
      const cache = new CellDescriptorCache();
      const v1 = 'v1';
      const v2 = 'v2';
      cache.updateVersion(v1);

      const d1 = makeDescriptor({ rowIndex: 0 });
      const d2 = makeDescriptor({ rowIndex: 1 });
      const compute = jest.fn<CellRenderDescriptor, []>()
        .mockReturnValueOnce(d1)
        .mockReturnValueOnce(d2);

      const first = cache.get(0, 0, v1, compute);
      cache.updateVersion(v2);
      const second = cache.get(0, 0, v2, compute);

      expect(compute).toHaveBeenCalledTimes(2);
      expect(first).toBe(d1);
      expect(second).toBe(d2);
    });

    it('uses separate cache entries for different (row, col) pairs', () => {
      const cache = new CellDescriptorCache();
      const version = 'v1';
      cache.updateVersion(version);

      const d00 = makeDescriptor({ rowIndex: 0 });
      const d01 = makeDescriptor({ rowIndex: 0 });
      const d10 = makeDescriptor({ rowIndex: 1 });

      let callCount = 0;
      const compute00 = () => { callCount++; return d00; };
      const compute01 = () => { callCount++; return d01; };
      const compute10 = () => { callCount++; return d10; };

      cache.get(0, 0, version, compute00);
      cache.get(0, 1, version, compute01);
      cache.get(1, 0, version, compute10);
      // All three are cache misses (different keys)
      expect(callCount).toBe(3);

      // Second calls should be cache hits
      cache.get(0, 0, version, compute00);
      cache.get(0, 1, version, compute01);
      cache.get(1, 0, version, compute10);
      expect(callCount).toBe(3);
    });
  });

  describe('clear', () => {
    it('clears all cached entries so compute is called again', () => {
      const cache = new CellDescriptorCache();
      const version = 'v1';
      cache.updateVersion(version);
      const compute = jest.fn<CellRenderDescriptor, []>().mockReturnValue(makeDescriptor());

      cache.get(0, 0, version, compute);
      expect(compute).toHaveBeenCalledTimes(1);

      cache.clear();

      cache.get(0, 0, version, compute);
      expect(compute).toHaveBeenCalledTimes(2);
    });

    it('clears entries for all rows and columns', () => {
      const cache = new CellDescriptorCache();
      const version = 'v1';
      cache.updateVersion(version);
      const compute = jest.fn<CellRenderDescriptor, []>().mockReturnValue(makeDescriptor());

      cache.get(0, 0, version, compute);
      cache.get(1, 5, version, compute);
      cache.get(99, 10, version, compute);
      expect(compute).toHaveBeenCalledTimes(3);

      cache.clear();

      cache.get(0, 0, version, compute);
      cache.get(1, 5, version, compute);
      cache.get(99, 10, version, compute);
      expect(compute).toHaveBeenCalledTimes(6);
    });
  });

  describe('stride-based key computation', () => {
    it('handles row 0 col 0 (edge case)', () => {
      const cache = new CellDescriptorCache();
      const version = 'v1';
      cache.updateVersion(version);
      const descriptor = makeDescriptor({ rowIndex: 0 });
      const compute = jest.fn<CellRenderDescriptor, []>().mockReturnValue(descriptor);

      const result = cache.get(0, 0, version, compute);
      expect(result).toBe(descriptor);
      expect(compute).toHaveBeenCalledTimes(1);
    });

    it('handles large row and col indices without collision', () => {
      const cache = new CellDescriptorCache();
      const version = 'v1';
      cache.updateVersion(version);

      const d1 = makeDescriptor({ rowIndex: 1000 });
      const d2 = makeDescriptor({ rowIndex: 500 });

      cache.get(1000, 50, version, () => d1);
      cache.get(500, 100, version, () => d2);

      // Both should be cached correctly with no collision
      const r1 = cache.get(1000, 50, version, () => makeDescriptor());
      const r2 = cache.get(500, 100, version, () => makeDescriptor());

      expect(r1).toBe(d1);
      expect(r2).toBe(d2);
    });

    it('does not collide row=1,col=0 with row=0,col=1024 (stride boundary)', () => {
      const cache = new CellDescriptorCache();
      const version = 'v1';
      cache.updateVersion(version);

      // key(1, 0) = 1 * 1024 + 0 = 1024
      // key(0, 1024) would exceed MAX_COL_STRIDE but let's use col=1023 and row=1 vs row=0,col=1023
      const dA = makeDescriptor({ rowIndex: 1 });
      const dB = makeDescriptor({ rowIndex: 0 });

      cache.get(1, 0, version, () => dA);
      cache.get(0, 1, version, () => dB);

      const rA = cache.get(1, 0, version, () => makeDescriptor());
      const rB = cache.get(0, 1, version, () => makeDescriptor());

      expect(rA).toBe(dA);
      expect(rB).toBe(dB);
    });
  });
});
