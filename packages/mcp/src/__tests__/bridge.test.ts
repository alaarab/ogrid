import { request } from 'node:http';
import { BridgeStore, MAX_BODY_BYTES, startBridgeServer } from '../bridge';

const PORT = 17000 + Math.floor(Math.random() * 2000);

function call(opts: {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port: PORT, method: opts.method, path: opts.path, headers: opts.headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() }));
      },
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

const json = { 'Content-Type': 'application/json', Host: `localhost:${PORT}` };

describe('bridge server request guards', () => {
  const store = new BridgeStore();
  let stop: () => Promise<void>;

  beforeAll(async () => {
    stop = await startBridgeServer(store, PORT);
  });
  afterAll(async () => {
    await stop();
  });

  it('accepts JSON writes from localhost', async () => {
    const res = await call({ method: 'POST', path: '/grids/connect', headers: json, body: JSON.stringify({ gridId: 'g1' }) });
    expect(res.status).toBe(200);
    expect(store.getState('g1')?.gridId).toBe('g1');
  });

  it('refuses text/plain writes (they would skip the CORS preflight)', async () => {
    const res = await call({
      method: 'POST',
      path: '/grids/connect',
      headers: { 'Content-Type': 'text/plain', Host: `localhost:${PORT}` },
      body: JSON.stringify({ gridId: 'evil' }),
    });
    expect(res.status).toBe(403);
    expect(store.getState('evil')).toBeUndefined();
  });

  it('refuses non-localhost origins, even for GET', async () => {
    const res = await call({ method: 'GET', path: '/grids/g1/commands', headers: { Origin: 'https://evil.example', Host: `localhost:${PORT}` } });
    expect(res.status).toBe(403);
  });

  it('refuses a non-loopback Host header (DNS rebinding)', async () => {
    const res = await call({ method: 'GET', path: '/health', headers: { Host: `evil.example:${PORT}` } });
    expect(res.status).toBe(403);
  });

  it('rejects oversized bodies with a readable 413 (not a reset socket)', async () => {
    const big = Buffer.alloc(MAX_BODY_BYTES + 1024, 32);
    const res = await call({ method: 'PUT', path: '/grids/g1/state', headers: json, body: big });
    expect(res.status).toBe(413);
    expect(JSON.parse(res.body).error).toContain('exceeds');
  });

  it('answers a malformed request URL with 400 instead of crashing', async () => {
    const res = await call({ method: 'GET', path: '//', headers: { Host: `localhost:${PORT}` } });
    expect(res.status).toBe(400);
    const health = await call({ method: 'GET', path: '/health', headers: { Host: `localhost:${PORT}` } });
    expect(health.status).toBe(200);
  });

  it('decodes percent-encoded gridIds so connect, state and commands agree', async () => {
    const id = 'my grid/users';
    const enc = encodeURIComponent(id);
    await call({ method: 'POST', path: '/grids/connect', headers: json, body: JSON.stringify({ gridId: id }) });
    const put = await call({ method: 'PUT', path: `/grids/${enc}/state`, headers: json, body: JSON.stringify({ rowCount: 7 }) });
    expect(put.status).toBe(200);
    expect(store.getState(id)?.rowCount).toBe(7);
    expect(store.getState(enc)).toBeUndefined();

    const cmd = store.enqueueCommand(id, 'clear_filters', {});
    const poll = await call({ method: 'GET', path: `/grids/${enc}/commands`, headers: { Host: `localhost:${PORT}` } });
    expect(JSON.parse(poll.body).map((c: { id: string }) => c.id)).toEqual([cmd?.id]);
  });

  it('rejects non-object state bodies and drops ill-typed fields', async () => {
    await call({ method: 'POST', path: '/grids/connect', headers: json, body: JSON.stringify({ gridId: 'shape' }) });
    const bad = await call({ method: 'PUT', path: '/grids/shape/state', headers: json, body: 'null' });
    expect(bad.status).toBe(400);

    const res = await call({
      method: 'PUT',
      path: '/grids/shape/state',
      headers: json,
      body: JSON.stringify({ columns: null, sortModel: 'name', filterModel: [], data: 5, rowCount: 'x', lastSeen: 0 }),
    });
    expect(res.status).toBe(200);
    const state = store.getState('shape');
    expect(state?.columns).toEqual([]);
    expect(state?.sortModel).toEqual([]);
    expect(state?.filterModel).toEqual({});
    expect(state?.data).toEqual([]);
    expect(state?.rowCount).toBe(0);
    expect(state?.lastSeen).toBeGreaterThan(0);
  });

  it('only lets the grid a command was sent to resolve it', async () => {
    await call({ method: 'POST', path: '/grids/connect', headers: json, body: JSON.stringify({ gridId: 'owner' }) });
    await call({ method: 'POST', path: '/grids/connect', headers: json, body: JSON.stringify({ gridId: 'other' }) });
    const cmd = store.enqueueCommand('owner', 'clear_filters', {});
    const id = encodeURIComponent(cmd?.id ?? '');

    await call({ method: 'POST', path: `/grids/other/commands/${id}/result`, headers: json, body: JSON.stringify({ result: 'forged' }) });
    await expect(store.waitForResult(cmd?.id ?? '', 150)).rejects.toThrow('timed out');
  });
});

describe('BridgeStore.prune', () => {
  it('forgets grids and results that went stale', () => {
    const store = new BridgeStore();
    store.upsertGrid('old', {});
    const cmd = store.enqueueCommand('old', 'getState' as never, {});
    expect(cmd).not.toBeNull();
    store.prune(Date.now() + 60 * 60_000);
    expect(store.getState('old')).toBeUndefined();
  });
});

describe('BridgeStore command timeout', () => {
  it('drops a timed-out command so the app never runs it late', async () => {
    const store = new BridgeStore();
    store.upsertGrid('slow', {});
    const cmd = store.enqueueCommand('slow', 'go_to_page', { page: 2 });
    await expect(store.waitForResult(cmd?.id ?? '', 150)).rejects.toThrow('timed out');
    expect(store.popPendingCommands('slow')).toEqual([]);
  });
});

describe('BridgeStore heartbeat', () => {
  it('updates lastSeen on a heartbeat with an empty partial', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const store = new BridgeStore();
    try {
      store.upsertGrid('g1', {});
      expect(store.getState('g1')?.lastSeen).toBe(1_000_000);

      // 60s later the client heartbeats with an empty body; lastSeen must move.
      nowSpy.mockReturnValue(1_060_000);
      store.upsertGrid('g1', {});

      expect(store.getState('g1')?.lastSeen).toBe(1_060_000);
      expect(store.listGrids()).toHaveLength(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('does not let a partial override lastSeen or connectedAt', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(2_000_000);
    const store = new BridgeStore();
    try {
      store.upsertGrid('g2', {});
      nowSpy.mockReturnValue(2_060_000);
      store.upsertGrid('g2', { lastSeen: 0, connectedAt: 0 });

      const state = store.getState('g2');
      expect(state?.lastSeen).toBe(2_060_000);
      expect(state?.connectedAt).toBe(2_000_000);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
