import { connectGridToBridge } from '../bridge-client';

type FetchCall = { url: string; init?: RequestInit };

const realFetch = globalThis.fetch;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('connectGridToBridge polling', () => {
  it('never runs overlapping polls when the bridge is slow', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    globalThis.fetch = (async (url: string) => {
      if (String(url).endsWith('/commands')) {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await wait(60);
        inFlight--;
        return json([]);
      }
      return json({ ok: true });
    }) as typeof fetch;

    const bridge = connectGridToBridge({ gridId: 'g', getData: () => [], getColumns: () => [], pollIntervalMs: 5 });
    await wait(250);
    bridge.disconnect();
    expect(maxInFlight).toBe(1);
  });

  it('does not run commands that arrive after disconnect, and aborts in-flight requests', async () => {
    const calls: FetchCall[] = [];
    let releasePoll: (() => void) | undefined;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/commands')) {
        await new Promise<void>((r) => {
          releasePoll = r;
        });
        return json([{ id: 'c1', type: 'update_cell', payload: { rowIndex: 0, columnId: 'a', value: 1 } }]);
      }
      return json({ ok: true });
    }) as typeof fetch;

    const updates: unknown[] = [];
    const bridge = connectGridToBridge({
      gridId: 'g',
      getData: () => [],
      getColumns: () => [],
      pollIntervalMs: 5,
      onCellUpdate: (...args) => updates.push(args),
    });
    await wait(30);
    expect(releasePoll).toBeDefined();
    const poll = calls.find((c) => c.url.endsWith('/commands'));
    bridge.disconnect();
    expect(poll?.init?.signal?.aborted).toBe(true);
    releasePoll?.();
    await wait(30);
    expect(updates).toEqual([]);
  });
});

describe('connectGridToBridge with an IOGridApi', () => {
  async function run(api: object, command: { type: string; payload: Record<string, unknown> }) {
    const posted: Array<{ url: string; body: unknown }> = [];
    let served = false;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.body) posted.push({ url: u, body: JSON.parse(String(init.body)) });
      if (u.endsWith('/commands')) {
        if (served) return json([]);
        served = true;
        return json([{ id: 'c1', ...command }]);
      }
      return json({ ok: true });
    }) as typeof fetch;
    const bridge = connectGridToBridge({ gridId: 'g', getData: () => [], getColumns: () => [], api, pollIntervalMs: 5 });
    await wait(60);
    bridge.disconnect();
    return posted;
  }

  it('applies set_filter through setFilterModel, keeping other filters', async () => {
    const models: unknown[] = [];
    const api = {
      getColumnState: () => ({ visibleColumns: [], filters: { status: { type: 'text', value: 'open' } } }),
      setFilterModel: (f: unknown) => models.push(f),
    };
    const posted = await run(api, { type: 'set_filter', payload: { columnId: 'dept', value: ['Eng', 'Ops'] } });
    expect(models[0]).toEqual({ status: { type: 'text', value: 'open' }, dept: { type: 'multiSelect', value: ['Eng', 'Ops'] } });
    expect(posted.find((p) => p.url.endsWith('/c1/result'))?.body).toEqual({ result: { ok: true } });
  });

  it('applies set_sort through applyColumnState', async () => {
    const states: unknown[] = [];
    const api = { applyColumnState: (s: unknown) => states.push(s) };
    await run(api, { type: 'set_sort', payload: { sortModel: [{ columnId: 'name', direction: 'desc' }] } });
    expect(states[0]).toEqual({ sort: { field: 'name', direction: 'desc' } });
  });

  it('pushes the selected row ids with each state update', async () => {
    const api = { getSelectedRows: () => ['r1', 'r2'] };
    const posted = await run(api, { type: 'clear_filters', payload: {} });
    const state = posted.find((p) => p.url.endsWith('/state'))?.body as { selectedRowIds?: unknown };
    expect(state?.selectedRowIds).toEqual(['r1', 'r2']);
  });

  it('reports a malformed payload instead of passing it to the app', async () => {
    const pages: unknown[] = [];
    const posted = await run({ goToPage: (p: unknown) => pages.push(p) }, { type: 'go_to_page', payload: { page: '2' } });
    expect(pages).toEqual([]);
    const result = posted.find((p) => p.url.endsWith('/c1/result'))?.body as { error?: string };
    expect(result?.error).toContain('go_to_page needs');
  });
});
