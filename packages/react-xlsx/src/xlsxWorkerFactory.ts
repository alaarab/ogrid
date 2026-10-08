// Keep this literal URL in its own emitted module so Vite, webpack 5 and Next
// can discover the worker asset when bundling the published package.
export function createXlsxWorker(): Worker {
  return new Worker(new URL('./xlsxWorker.js', import.meta.url), { type: 'module' });
}
