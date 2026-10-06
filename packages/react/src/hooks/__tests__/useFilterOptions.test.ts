import * as React from 'react';
import { act } from '@testing-library/react';
import { createRoot, type Root } from 'react-dom/client';
import { useFilterOptions } from '../useFilterOptions';
import type { IDataSource } from '../../types/dataGridTypes';

describe('useFilterOptions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  function Harness({
    dataSource,
    fields,
  }: {
    dataSource: IDataSource<unknown>;
    fields: string[];
  }): React.ReactElement {
    const result = useFilterOptions(dataSource, fields);
    return React.createElement('pre', { 'data-testid': 'result' }, JSON.stringify(result));
  }

  function renderAndGetResult(dataSource: IDataSource<unknown>, fields: string[]): unknown {
    act(() => {
      root.render(React.createElement(Harness, { dataSource, fields }));
    });
    const pre = container.querySelector('[data-testid="result"]');
    return pre ? JSON.parse(pre.textContent || '{}') : {};
  }

  const minimalDataSource = (): IDataSource<unknown> => ({
    fetchPage: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }),
  });

  it('returns empty filterOptions and loadingOptions when fetchFilterOptions is missing', async () => {
    const dataSource = minimalDataSource();
    renderAndGetResult(dataSource, ['a', 'b']);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const after = JSON.parse(container.querySelector('[data-testid="result"]')?.textContent || '{}');
    expect(after.filterOptions).toEqual({});
    expect(after.loadingOptions).toEqual({});
  });

  it('loads filter options via fetchFilterOptions and populates filterOptions', async () => {
    const resolvers: Record<string, (v: string[]) => void> = {};
    const dataSource: IDataSource<unknown> = {
      ...minimalDataSource(),
      fetchFilterOptions: jest.fn((field: string) => new Promise((resolve) => { resolvers[field] = resolve; })),
    };
    renderAndGetResult(dataSource, ['client', 'stage']);

    await act(async () => {
      resolvers.client(['Acme', 'Beta']);
      resolvers.stage(['Active', 'Closed']);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const after = JSON.parse(container.querySelector('[data-testid="result"]')?.textContent || '{}');
    expect(after.filterOptions).toEqual({ client: ['Acme', 'Beta'], stage: ['Active', 'Closed'] });
    expect(after.loadingOptions).toEqual({});
    expect(dataSource.fetchFilterOptions).toHaveBeenCalledWith('client');
    expect(dataSource.fetchFilterOptions).toHaveBeenCalledWith('stage');
  });

  it('sets loadingOptions to true before resolvers complete, then false after', async () => {
    let resolveClient: (v: string[]) => void;
    let resolveStage: (v: string[]) => void;
    const clientPromise = new Promise<string[]>((r) => { resolveClient = r; });
    const stagePromise = new Promise<string[]>((r) => { resolveStage = r; });
    const dataSource: IDataSource<unknown> = {
      ...minimalDataSource(),
      fetchFilterOptions: jest.fn((field: string) => (field === 'client' ? clientPromise : stagePromise)),
    };
    renderAndGetResult(dataSource, ['client', 'stage']);

    const initial = JSON.parse(container.querySelector('[data-testid="result"]')?.textContent || '{}');
    expect(initial.loadingOptions?.client).toBe(true);
    expect(initial.loadingOptions?.stage).toBe(true);

    await act(async () => {
      resolveClient!(['Acme']);
      resolveStage!(['Active']);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const after = JSON.parse(container.querySelector('[data-testid="result"]')?.textContent || '{}');
    expect(after.loadingOptions).toEqual({});
    expect(after.filterOptions).toEqual({ client: ['Acme'], stage: ['Active'] });
  });

  it('sets a field to empty array when fetchFilterOptions throws', async () => {
    const dataSource: IDataSource<unknown> = {
      ...minimalDataSource(),
      fetchFilterOptions: jest.fn((field: string) =>
        field === 'bad' ? Promise.reject(new Error('fail')) : Promise.resolve(['ok'])
      ),
    };
    renderAndGetResult(dataSource, ['good', 'bad']);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const after = JSON.parse(container.querySelector('[data-testid="result"]')?.textContent || '{}');
    expect(after.filterOptions).toEqual({ good: ['ok'], bad: [] });
    expect(after.loadingOptions).toEqual({});
    consoleSpy.mockRestore();
  });

  it('ignores stale results when the data source is replaced mid-load', async () => {
    let resolveOld: (v: string[]) => void;
    const dataSourceA: IDataSource<unknown> = {
      ...minimalDataSource(),
      fetchFilterOptions: jest.fn(
        (_field: string) => new Promise<string[]>((resolve) => { resolveOld = resolve; })
      ),
    };
    const dataSourceB: IDataSource<unknown> = {
      ...minimalDataSource(),
      fetchFilterOptions: jest.fn().mockResolvedValue(['New']),
    };

    renderAndGetResult(dataSourceA, ['field']);

    // Swap the source while the old load is still in flight.
    act(() => {
      root.render(React.createElement(Harness, { dataSource: dataSourceB, fields: ['field'] }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const afterSwap = JSON.parse(container.querySelector('[data-testid="result"]')?.textContent || '{}');
    expect(afterSwap.filterOptions).toEqual({ field: ['New'] });

    // The stale source resolves last with old options; it must be discarded.
    await act(async () => {
      resolveOld!(['Stale']);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const after = JSON.parse(container.querySelector('[data-testid="result"]')?.textContent || '{}');
    expect(after.filterOptions).toEqual({ field: ['New'] });
    expect(after.loadingOptions).toEqual({});
  });
});

describe('useFilterOptions: stale results and inline sources (D17, V06)', () => {
  const { renderHook, waitFor } = require('@testing-library/react') as typeof import('@testing-library/react');
  const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  function deferred() {
    const map: Record<string, (v: string[]) => void> = {};
    const fetchFilterOptions = jest.fn((field: string) => new Promise<string[]>((resolve) => { map[field] = resolve; }));
    return { map, fetchFilterOptions };
  }

  it('shows each field as soon as its options load', async () => {
    const { map, fetchFilterOptions } = deferred();
    const source = { fetchFilterOptions };
    const { result } = renderHook(() => useFilterOptions(source, ['a', 'b']));
    await act(async () => { map.a?.(['A1']); await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.filterOptions).toEqual({ a: ['A1'] });
    expect(result.current.loadingOptions).toEqual({ b: true });
    await act(async () => { map.b?.(['B1']); await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.filterOptions).toEqual({ a: ['A1'], b: ['B1'] });
    expect(result.current.loadingOptions).toEqual({});
  });

  it("drops the previous source's options as soon as the source is swapped", async () => {
    const a = { fetchFilterOptions: jest.fn().mockResolvedValue(['Old']) };
    const b = deferred();
    const { result, rerender } = renderHook(({ ds }) => useFilterOptions(ds, ['f']), { initialProps: { ds: a as { fetchFilterOptions: (f: string) => Promise<string[]> } } });
    await waitFor(() => expect(result.current.filterOptions).toEqual({ f: ['Old'] }));
    rerender({ ds: { fetchFilterOptions: b.fetchFilterOptions } });
    await flush();
    expect(result.current.filterOptions).toEqual({});
    expect(result.current.loadingOptions).toEqual({ f: true });
    await act(async () => { b.map.f?.(['New']); await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.filterOptions).toEqual({ f: ['New'] });
  });

  it('keeps options for fields that stay when another field is added', async () => {
    const calls: string[] = [];
    const fetchFilterOptions = jest.fn((field: string) => { calls.push(field); return Promise.resolve([field.toUpperCase()]); });
    const source = { fetchFilterOptions };
    const { result, rerender } = renderHook(({ fields }) => useFilterOptions(source, fields), { initialProps: { fields: ['a'] } });
    await waitFor(() => expect(result.current.filterOptions).toEqual({ a: ['A'] }));
    rerender({ fields: ['a', 'b'] });
    expect(result.current.filterOptions.a).toEqual(['A']);
    await waitFor(() => expect(result.current.filterOptions).toEqual({ a: ['A'], b: ['B'] }));
  });

  it('an inline source around the same fetcher does not reload on re-render', async () => {
    const fetchFilterOptions = jest.fn().mockResolvedValue(['x']);
    const { rerender } = renderHook(() => useFilterOptions({ fetchFilterOptions }, ['f']));
    for (let i = 0; i < 3; i++) {
      rerender();
      await flush();
    }
    expect(fetchFilterOptions).toHaveBeenCalledTimes(1);
  });

  it('with dataSourceKey, reloads only when the key changes', async () => {
    const calls: string[] = [];
    const { rerender } = renderHook(
      ({ key }) => useFilterOptions({ fetchFilterOptions: () => { calls.push(key); return Promise.resolve(['x']); } }, ['f'], { dataSourceKey: key }),
      { initialProps: { key: 'a' } },
    );
    for (let i = 0; i < 3; i++) {
      rerender({ key: 'a' });
      await flush();
    }
    expect(calls).toEqual(['a']);
    rerender({ key: 'b' });
    await flush();
    expect(calls).toEqual(['a', 'b']);
  });
});
