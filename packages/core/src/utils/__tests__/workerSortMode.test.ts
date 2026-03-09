import { DEFAULT_WORKER_SORT_AUTO_THRESHOLD, shouldUseWorkerSort } from '../workerSortMode';

describe('workerSortMode', () => {
  it('returns false by default', () => {
    expect(shouldUseWorkerSort(undefined, 100)).toBe(false);
  });

  it('returns false for explicit false', () => {
    expect(shouldUseWorkerSort(false, 10_000)).toBe(false);
  });

  it('returns true for explicit true', () => {
    expect(shouldUseWorkerSort(true, 10)).toBe(true);
  });

  it('keeps auto mode synchronous at or below the threshold', () => {
    expect(shouldUseWorkerSort('auto', DEFAULT_WORKER_SORT_AUTO_THRESHOLD)).toBe(false);
  });

  it('enables auto mode above the threshold', () => {
    expect(shouldUseWorkerSort('auto', DEFAULT_WORKER_SORT_AUTO_THRESHOLD + 1)).toBe(true);
  });

  it('keeps worker sort off when a people filter is active', () => {
    expect(
      shouldUseWorkerSort('auto', DEFAULT_WORKER_SORT_AUTO_THRESHOLD + 1, {
        filters: {
          owner: {
            type: 'people',
            value: { displayName: 'Ada', email: 'ada@example.com' },
          },
        },
      })
    ).toBe(false);
  });

  it('keeps worker sort off when the active sort column has a custom compare', () => {
    expect(
      shouldUseWorkerSort('auto', DEFAULT_WORKER_SORT_AUTO_THRESHOLD + 1, {
        sortBy: 'score',
        columns: [
          { columnId: 'name', name: 'Name' },
          { columnId: 'score', name: 'Score', compare: (left, right) => Number(left) - Number(right) },
        ],
      })
    ).toBe(false);
  });
});
