import { afterAll } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker as ThreadWorker } from 'node:worker_threads';

let directory: string | undefined;
let bundle: Promise<string> | undefined;
const workers = new Set<ThreadWorker>();
afterAll(async () => {
  await Promise.all([...workers].map(worker => worker.terminate()));
  if (directory) await rm(directory, { recursive: true, force: true });
  bundle = undefined;
  directory = undefined;
});

/** Run the production browser worker with real structured-clone messages.
 * The adapter supplies only the browser event API; parsing and ACKs stay real. */
export async function xlsxWorkerFactory(receive?: (message: any) => void): Promise<() => Worker> {
  bundle ??= (async () => {
    directory = await mkdtemp(join(tmpdir(), 'ogrid-xlsx-worker-'));
    const path = join(directory, 'worker.mjs');
    const result = await Bun.build({
      entrypoints: [new URL('../../xlsxWorker.ts', import.meta.url).pathname],
      target: 'bun', format: 'esm',
      define: { 'process.env.NODE_ENV': '"production"' },
    });
    if (!result.success) throw new AggregateError(result.logs, 'Could not bundle XLSX worker');
    await Bun.write(path, result.outputs[0]!);
    return pathToFileURL(path).href;
  })();
  const url = await bundle;
  return () => {
    const thread = new ThreadWorker(`
      const { parentPort } = require('node:worker_threads');
      globalThis.postMessage = (message, transfer) => parentPort.postMessage(message, transfer);
      const ready = import(${JSON.stringify(url)});
      parentPort.on('message', async data => { await ready; globalThis.onmessage({ data }); });
    `, { eval: true });
    workers.add(thread);
    const adapter = {
      onmessage: null as Worker['onmessage'],
      onerror: null as Worker['onerror'],
      onmessageerror: null as Worker['onmessageerror'],
      postMessage: (message: unknown) => thread.postMessage(message),
      terminate: () => { workers.delete(thread); void thread.terminate(); },
    };
    thread.on('message', data => { receive?.(data); adapter.onmessage?.({ data } as MessageEvent); });
    thread.on('error', error => adapter.onerror?.({ message: error.message, preventDefault() {} } as ErrorEvent));
    thread.on('messageerror', () => adapter.onmessageerror?.({} as MessageEvent));
    return adapter as unknown as Worker;
  };
}
