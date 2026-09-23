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
    req.on('error', (err) => {
      // The server may reset an oversized upload before reading it all.
      if ((err as NodeJS.ErrnoException).code === 'ECONNRESET' || (err as NodeJS.ErrnoException).code === 'EPIPE') {
        resolve({ status: 413, body: '' });
        return;
      }
      reject(err);
    });
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

  it('rejects oversized bodies', async () => {
    const big = Buffer.alloc(MAX_BODY_BYTES + 1024, 32);
    const res = await call({ method: 'PUT', path: '/grids/g1/state', headers: json, body: big });
    expect(res.status).toBe(413);
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
