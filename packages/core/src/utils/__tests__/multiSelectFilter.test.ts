import { createMultiSelectMatcher, getMultiSelectCellValues } from '../multiSelectFilter';
import { processClientSideData } from '../clientSideData';
import { deriveFilterOptionsFromData } from '../ogridHelpers';
import { shouldUseWorkerSort } from '../workerSortMode';
import type { IColumnDef, IFilters } from '../../types';

interface Report {
  id: number;
  status: string | null;
  reviewers: string[];
}

const reports: Report[] = [
  { id: 1, status: 'open', reviewers: ['ana', 'ben'] },
  { id: 2, status: 'signed', reviewers: ['ben'] },
  { id: 3, status: null, reviewers: [] },
  { id: 4, status: 'open', reviewers: ['cy', 'ana', 'ben'] },
];

const columns: IColumnDef<Report>[] = [
  { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect' } },
  { columnId: 'reviewers', name: 'Reviewers', filterable: { type: 'multiSelect', multiValue: true } },
];

const ids = (filters: IFilters) => processClientSideData(reports, columns, filters).map((r) => r.id);

describe('multi-select matching', () => {
  it('reads array items as options, an empty array or null as blank', () => {
    expect(getMultiSelectCellValues(['a', 2, null])).toEqual(['a', '2', '']);
    expect(getMultiSelectCellValues([])).toEqual(['']);
    expect(getMultiSelectCellValues(undefined)).toEqual(['']);
  });

  it('any / none on a single-value column (none is exclude, "not in")', () => {
    expect(ids({ status: { type: 'multiSelect', value: ['open'] } })).toEqual([1, 4]);
    expect(ids({ status: { type: 'multiSelect', value: ['open'], mode: 'none' } })).toEqual([2, 3]);
    expect(ids({ status: { type: 'multiSelect', value: ['open', ''], mode: 'none' } })).toEqual([2]);
  });

  it('any / all / none on an array column', () => {
    expect(ids({ reviewers: { type: 'multiSelect', value: ['ana', 'cy'] } })).toEqual([1, 4]);
    expect(ids({ reviewers: { type: 'multiSelect', value: ['ana', 'ben'], mode: 'all' } })).toEqual([1, 4]);
    expect(ids({ reviewers: { type: 'multiSelect', value: ['ana'], mode: 'none' } })).toEqual([2, 3]);
    expect(ids({ reviewers: { type: 'multiSelect', value: [''] } })).toEqual([3]);
  });

  it('all on a single value needs every selected option to be that value', () => {
    const all = createMultiSelectMatcher(['open', 'signed'], 'all');
    expect(all('open')).toBe(false);
    expect(createMultiSelectMatcher(['open'], 'all')('open')).toBe(true);
  });

  it('derives options from array items', () => {
    expect(deriveFilterOptionsFromData(reports, columns).reviewers).toEqual(['', 'ana', 'ben', 'cy']);
  });

  it('keeps worker sort off for modes other than any and for multiValue columns', () => {
    const plain: IColumnDef<Report>[] = [columns[0] as IColumnDef<Report>];
    expect(shouldUseWorkerSort(true, 10, { columns: plain, filters: { status: { type: 'multiSelect', value: ['open'] } } })).toBe(true);
    expect(shouldUseWorkerSort(true, 10, { columns: plain, filters: { status: { type: 'multiSelect', value: ['open'], mode: 'none' } } })).toBe(false);
    expect(shouldUseWorkerSort(true, 10, { columns })).toBe(false);
  });
});
