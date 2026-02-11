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
});
