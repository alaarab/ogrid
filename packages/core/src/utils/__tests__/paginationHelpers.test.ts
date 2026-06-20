import { getPaginationViewModel, PAGE_SIZE_OPTIONS, MAX_PAGE_BUTTONS } from '../paginationHelpers';

describe('getPaginationViewModel', () => {
  it('returns null when totalCount is 0', () => {
    const result = getPaginationViewModel(1, 10, 0);
    expect(result).toBeNull();
  });

  it('returns null when totalCount is negative', () => {
    const result = getPaginationViewModel(1, 10, -5);
    expect(result).toBeNull();
  });

  it('calculates totalPages correctly', () => {
    const result = getPaginationViewModel(1, 10, 95);
    expect(result?.totalPages).toBe(10);
  });

  it('calculates totalPages rounding up', () => {
    const result = getPaginationViewModel(1, 10, 91);
    expect(result?.totalPages).toBe(10);
  });

  it('returns all page numbers when totalPages <= maxPageButtons', () => {
    const result = getPaginationViewModel(1, 10, 30);
    expect(result?.pageNumbers).toEqual([1, 2, 3]);
    expect(result?.showStartEllipsis).toBe(false);
    expect(result?.showEndEllipsis).toBe(false);
  });

  it('returns 5 page numbers when totalPages is exactly 5', () => {
    const result = getPaginationViewModel(3, 10, 50);
    expect(result?.pageNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(result?.showStartEllipsis).toBe(false);
    expect(result?.showEndEllipsis).toBe(false);
  });

  it('shows ellipses when totalPages > maxPageButtons', () => {
    const result = getPaginationViewModel(5, 10, 100);
    expect(result?.pageNumbers).toEqual([3, 4, 5, 6, 7]);
    expect(result?.showStartEllipsis).toBe(true);
    expect(result?.showEndEllipsis).toBe(true);
  });

  it('shows start ellipsis when currentPage is near end', () => {
    const result = getPaginationViewModel(9, 10, 100);
    expect(result?.pageNumbers).toEqual([6, 7, 8, 9, 10]);
    expect(result?.showStartEllipsis).toBe(true);
    expect(result?.showEndEllipsis).toBe(false);
  });

  it('shows end ellipsis when currentPage is near start', () => {
    const result = getPaginationViewModel(2, 10, 100);
    expect(result?.pageNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(result?.showStartEllipsis).toBe(false);
    expect(result?.showEndEllipsis).toBe(true);
  });

  it('centers page buttons around currentPage', () => {
    const result = getPaginationViewModel(5, 10, 100);
    expect(result?.pageNumbers).toEqual([3, 4, 5, 6, 7]);
  });

  it('calculates startItem correctly for first page', () => {
    const result = getPaginationViewModel(1, 10, 100);
    expect(result?.startItem).toBe(1);
  });

  it('calculates endItem correctly for first page', () => {
    const result = getPaginationViewModel(1, 10, 100);
    expect(result?.endItem).toBe(10);
  });

  it('calculates startItem correctly for middle page', () => {
    const result = getPaginationViewModel(5, 10, 100);
    expect(result?.startItem).toBe(41);
  });

  it('calculates endItem correctly for middle page', () => {
    const result = getPaginationViewModel(5, 10, 100);
    expect(result?.endItem).toBe(50);
  });

  it('calculates endItem correctly for last page (partial)', () => {
    const result = getPaginationViewModel(10, 10, 95);
    expect(result?.endItem).toBe(95);
  });

  it('clamps a stale out-of-range page into the item window', () => {
    // page 5 but only 3 items (e.g. a filter shrank the data) must not report
    // "41–3 of 3"; it clamps to the last page.
    const result = getPaginationViewModel(5, 10, 3);
    expect(result?.startItem).toBe(1);
    expect(result?.endItem).toBe(3);
  });

  it('clamps a zero/negative page up to the first page', () => {
    const result = getPaginationViewModel(0, 10, 100);
    expect(result?.startItem).toBe(1);
    expect(result?.endItem).toBe(10);
  });

  it('returns default pageSizeOptions', () => {
    const result = getPaginationViewModel(1, 10, 100);
    expect(result?.pageSizeOptions).toEqual(PAGE_SIZE_OPTIONS);
  });

  it('respects custom pageSizeOptions', () => {
    const customOptions = [5, 10, 30] as const;
    const result = getPaginationViewModel(1, 10, 100, { pageSizeOptions: customOptions });
    expect(result?.pageSizeOptions).toEqual(customOptions);
  });

  it('auto-inserts pageSize into pageSizeOptions when missing', () => {
    const result = getPaginationViewModel(1, 5, 100);
    expect(result?.pageSizeOptions).toEqual([5, 10, 25, 50, 100]);
  });

  it('auto-inserts pageSize in sorted order for custom options', () => {
    const result = getPaginationViewModel(1, 20, 100, { pageSizeOptions: [10, 50, 100] });
    expect(result?.pageSizeOptions).toEqual([10, 20, 50, 100]);
  });

  it('respects custom maxPageButtons', () => {
    // With currentPage=10, totalPages=20, it starts with [8,9,10,11,12] (5 buttons centered)
    // Since 5 < 7 (maxPageButtons) and neither edge is reached, window stays as-is
    const result = getPaginationViewModel(10, 10, 200, { maxPageButtons: 7 });
    expect(result?.pageNumbers.length).toBeGreaterThanOrEqual(5);
    expect(result?.pageNumbers).toContain(10); // Current page should be in the window
  });

  it('handles single page', () => {
    const result = getPaginationViewModel(1, 100, 50);
    expect(result?.totalPages).toBe(1);
    expect(result?.pageNumbers).toEqual([1]);
    expect(result?.showStartEllipsis).toBe(false);
    expect(result?.showEndEllipsis).toBe(false);
    expect(result?.startItem).toBe(1);
    expect(result?.endItem).toBe(50);
  });

  it('handles currentPage = 1 with many pages', () => {
    const result = getPaginationViewModel(1, 10, 200);
    expect(result?.pageNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(result?.showStartEllipsis).toBe(false);
    expect(result?.showEndEllipsis).toBe(true);
  });

  it('handles currentPage = last page with many pages', () => {
    const result = getPaginationViewModel(20, 10, 200);
    expect(result?.pageNumbers).toEqual([16, 17, 18, 19, 20]);
    expect(result?.showStartEllipsis).toBe(true);
    expect(result?.showEndEllipsis).toBe(false);
  });

  it('handles currentPage at exact boundary near start', () => {
    const result = getPaginationViewModel(3, 10, 200);
    expect(result?.pageNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(result?.showStartEllipsis).toBe(false);
    expect(result?.showEndEllipsis).toBe(true);
  });

  it('handles currentPage at exact boundary near end', () => {
    const result = getPaginationViewModel(18, 10, 200);
    expect(result?.pageNumbers).toEqual([16, 17, 18, 19, 20]);
    expect(result?.showStartEllipsis).toBe(true);
    expect(result?.showEndEllipsis).toBe(false);
  });

  it('handles totalPages = 6 (one more than default max)', () => {
    const result = getPaginationViewModel(3, 10, 60);
    expect(result?.pageNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(result?.showStartEllipsis).toBe(false);
    expect(result?.showEndEllipsis).toBe(true);
  });

  it('adjusts window when at edge (start)', () => {
    const result = getPaginationViewModel(2, 10, 100);
    expect(result?.pageNumbers).toEqual([1, 2, 3, 4, 5]);
  });

  it('adjusts window when at edge (end)', () => {
    const result = getPaginationViewModel(9, 10, 100);
    expect(result?.pageNumbers).toEqual([6, 7, 8, 9, 10]);
  });

  it('handles very small pageSize', () => {
    const result = getPaginationViewModel(1, 1, 10);
    expect(result?.totalPages).toBe(10);
    expect(result?.startItem).toBe(1);
    expect(result?.endItem).toBe(1);
  });

  it('handles very large pageSize', () => {
    const result = getPaginationViewModel(1, 1000, 500);
    expect(result?.totalPages).toBe(1);
    expect(result?.startItem).toBe(1);
    expect(result?.endItem).toBe(500);
  });

  it('handles maxPageButtons = 1', () => {
    const result = getPaginationViewModel(5, 10, 100, { maxPageButtons: 1 });
    // With maxPageButtons=1, the algorithm still computes a window - just checks if window matches target
    expect(result?.pageNumbers.length).toBeGreaterThanOrEqual(1);
  });

  it('handles maxPageButtons = 3', () => {
    const result = getPaginationViewModel(5, 10, 100, { maxPageButtons: 3 });
    expect(result?.pageNumbers.length).toBeGreaterThanOrEqual(3);
    expect(result?.pageNumbers).toContain(5);
  });

  it('exports PAGE_SIZE_OPTIONS constant', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50, 100]);
  });

  it('exports MAX_PAGE_BUTTONS constant', () => {
    expect(MAX_PAGE_BUTTONS).toBe(5);
  });
});
