import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
// No CSS loader hook: Node resolves the kits' "node" export condition to an
// entry without the stylesheet import, the way Vite SSR / Vitest externals do.
registerHooks({
  // React 17 predates package exports; bundlers resolve its extensionless runtime.
  resolve(specifier, context, nextResolve) {
    return /\/node_modules\/(?:@radix-ui|@fluentui|@griffel)\//.test(context.parentURL ?? '')
      && (specifier === 'react/jsx-runtime' || specifier === 'react/jsx-dev-runtime')
      ? nextResolve(pathToFileURL(require.resolve(specifier)).href, context)
      : nextResolve(specifier, context);
  },
});
import { Window } from 'happy-dom';
const window = new Window();
// happy-dom rejects Animation.finished when Fluent's presence motion cancels an
// exit animation on unmount; browsers leave that rejection unobserved, Node would exit.
process.on('unhandledRejection', (reason) => {
  if (reason?.name === 'AbortError' && /animation/i.test(reason.message)) return;
  throw reason;
});
// Use the DOM environment's scheduler APIs; Node's MessageChannel leaves React 17 ports open.
// Event constructors too: Radix DismissableLayer/FocusScope dispatch CustomEvents, and happy-dom rejects Node's own Event classes.
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'FocusEvent', 'MutationObserver', 'ResizeObserver', 'MessageChannel', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: typeof window[key] === 'function' && ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? window[key].bind(window) : window[key] });
}
const React = (await import('react')).default;
const ReactDOM = (await import('react-dom')).default;
const { renderToString } = createRequire(import.meta.url)('react-dom/server');
const { RatingEditor } = await import('@alaarab/ogrid-react-inputs');
const changes = [];
const props = {
  editable: true,
  onCellValueChanged: event => changes.push(event),
  data: [{ id: 'one', name: 'Compatibility row', rating: 3 }],
  columns: [
    { columnId: 'name', name: 'Name', editable: true },
    // Premium popover editor: exercises @alaarab/ogrid-react-inputs through each kit's portal.
    { columnId: 'rating', name: 'Rating', editable: true, cellEditor: RatingEditor, cellEditorPopup: true },
  ],
  getRowId: row => row.id,
};
for (const name of ['@alaarab/ogrid-react-radix', '@alaarab/ogrid-react-fluent']) {
  const { OGrid, FindReplacePanel } = await import(name);
  const component = React.createElement(OGrid, { ...props, defaultSortBy: '', showRowNumbers: true, rowDragging: true, rangeMove: true, cellDrop: true, findReplace: true });
  const panel = React.createElement(FindReplacePanel, { find: { isOpen: true, mode: 'replace' }, onClose() {}, focusRequest: 1 });
  assert.match(renderToString(panel), /aria-busy/, `${name}: a directly rendered lazy panel is server safe`);
  assert.match(renderToString(component), /Compatibility row/, `${name}: SSR must render data`);
  const container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = renderToString(component);
  let root;
  if (React.version.startsWith('18.')) {
    root = (await import('react-dom/client')).hydrateRoot(container, component);
  } else ReactDOM.hydrate(component, container);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.match(container.textContent, /Compatibility row/, `${name}: hydration must render data`);
  assert.ok(container.querySelector('[data-ogrid-row-drag-handle]'), `${name}: drag enhances after hydration`);
  const region = container.querySelector('[role="region"]');
  region.querySelector('tbody [data-row-index]').dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
  region.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'h', ctrlKey: true, bubbles: true }));
  region.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'x', bubbles: true }));
  assert.equal(region.querySelector('tbody input'), null, `${name}: loading Replace protects the selected cell`);
  await new Promise(resolve => setTimeout(resolve, 400));
  const findInput = container.querySelector('[role="search"] input');
  assert.ok(findInput, `${name}: lazy Find input mounts`);
  assert.equal(document.activeElement, findInput, `${name}: lazy Find input receives focus`);
  findInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 50));
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
  const ratingContent = container.querySelector('td[data-column-id="rating"] [data-row-index][data-col-index]');
  assert.ok(ratingContent, `${name}: rating cell content exists`);
  ratingContent.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
  ratingContent.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ratingContent.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 100));
  const slider = document.querySelector('[role="slider"]');
  assert.ok(slider, `${name}: double click opens the react-inputs popover editor`);
  slider.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 50));
  slider.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(changes.at(-1)?.newValue, 4, `${name}: popover editor commits through onCellValueChanged`);
  changes.length = 0;
  if (root) ReactDOM.flushSync(() => root.unmount());
  else ReactDOM.unmountComponentAtNode(container);
  assert.equal(container.childElementCount, 0, `${name}: unmount removes grid`);
  container.remove();
  console.log(`${name} passed with React ${React.version}: public import, SSR, mount, inline editor, react-inputs popover editor and unmount`);
}
await window.happyDOM.close();
