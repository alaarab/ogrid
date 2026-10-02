import * as React from 'react';
import { renderHook } from '@testing-library/react';
import { useOGrid } from '../useOGrid';
import type { IOGridApi } from '../../types';

type Row = { id: string; name: string };

const data: Row[] = [{ id: '1', name: 'Alice' }];
const getRowId = (r: Row) => r.id;

describe('useOGrid column validation', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  const duplicateWarnings = () =>
    warnSpy.mock.calls.filter((c) => String(c[0]).includes('Duplicate columnId'));

  it('validates once per distinct columnId set, not on every new inline columns array', () => {
    const apiRef = React.createRef<IOGridApi<Row>>();
    const { rerender } = renderHook(
      ({ ids }: { ids: string[] }) =>
        useOGrid(
          {
            // A fresh array every render, as with an inline `columns={[...]}` prop.
            columns: ids.map((id) => ({ columnId: id, name: id })),
            data,
            getRowId,
          } as Parameters<typeof useOGrid<Row>>[0],
          apiRef
        ),
      { initialProps: { ids: ['name', 'name'] } }
    );
    expect(duplicateWarnings()).toHaveLength(1);

    rerender({ ids: ['name', 'name'] });
    rerender({ ids: ['name', 'name'] });
    expect(duplicateWarnings()).toHaveLength(1);

    rerender({ ids: ['id', 'id'] });
    expect(duplicateWarnings()).toHaveLength(2);
  });
});
