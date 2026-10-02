import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
// Node has no CSS loader; SSR bundlers treat stylesheet imports as assets.
registerHooks({
  // React 17 predates package exports; bundlers resolve its extensionless runtime.
  resolve(specifier, context, nextResolve) {
    return /\/node_modules\/(?:@radix-ui|@fluentui|@griffel)\//.test(context.parentURL ?? '')
      && (specifier === 'react/jsx-runtime' || specifier === 'react/jsx-dev-runtime')
      ? nextResolve(pathToFileURL(require.resolve(specifier)).href, context)
      : nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : nextLoad(url, context);
} });
import { Window } from 'happy-dom';
const window = new Window();
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'ResizeObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: typeof window[key] === 'function' && ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? window[key].bind(window) : window[key] });
}
const React = (await import('react')).default;
const ReactDOM = (await import('react-dom')).default;
const { renderToString } = createRequire(import.meta.url)('react-dom/server');
const changes = [];
const props = {
  editable: true,
  onCellValueChanged: event => changes.push(event),
  data: [{ id: 'one', name: 'Compatibility row' }],
  columns: [{ columnId: 'name', name: 'Name', editable: true }],
  getRowId: row => row.id,
};
for (const name of ['@alaarab/ogrid-react-radix', '@alaarab/ogrid-react-fluent']) {
  const { OGrid } = await import(name);
  const component = React.createElement(OGrid, props);
  assert.match(renderToString(component), /Compatibility row/, `${name}: SSR must render data`);
  const container = document.createElement('div');
  document.body.append(container);
  let root;
  if (React.version.startsWith('18.')) {
    root = (await import('react-dom/client')).createRoot(container);
    ReactDOM.flushSync(() => root.render(component));
  } else ReactDOM.render(component, container);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.match(container.textContent, /Compatibility row/, `${name}: mount must render data`);
  const cell = container.querySelector('td[data-column-id="name"]');
  assert.ok(cell, `${name}: editable cell exists`);
  const cellContent = cell.querySelector('[data-row-index][data-col-index]');
  assert.ok(cellContent, `${name}: interactive cell content exists`);
  cellContent.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
  cellContent.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  cellContent.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 100));
  const editor = cell.querySelector('input');
  assert.ok(editor, `${name}: double click opens cell editor`);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(editor, 'Edited row');
  editor.dispatchEvent(new window.Event('input', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 50));
  editor.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(changes.at(-1)?.newValue, 'Edited row', `${name}: Enter commits edited value`);
  changes.length = 0;
  if (root) ReactDOM.flushSync(() => root.unmount());
  else ReactDOM.unmountComponentAtNode(container);
  assert.equal(container.childElementCount, 0, `${name}: unmount removes grid`);
  container.remove();
  console.log(`${name} passed with React ${React.version}: public import, SSR, mount, editor and unmount`);
}
await window.happyDOM.close();
