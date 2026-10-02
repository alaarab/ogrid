// Automatic-JSX runtime bundled into the React packages (tsup `jsxImportSource`
// + `alias`) in place of 'react/jsx-runtime'. React 17 has no package.json
// "exports" map, so the bare 'react/jsx-runtime' specifier fails under strict
// ESM resolution (Node ESM, webpack 5 for "type": "module" packages). This
// delegates to createElement from the 'react' package root, which resolves on
// React 17, 18 and 19.
import { createElement, Fragment } from 'react';

export { Fragment };

function create(type, props, key, isStatic) {
  if (!('children' in props)) return createElement(type, key === undefined ? props : { ...props, key });
  const { children, ...config } = props;
  if (key !== undefined) config.key = key;
  // Static children (jsxs) are spread like classic JSX children so React does
  // not ask them for keys; a single or dynamic child is passed through as-is,
  // so arrays from .map() still get key warnings.
  return isStatic ? createElement(type, config, ...children) : createElement(type, config, children);
}

export function jsx(type, props, key) {
  return create(type, props, key, false);
}

export function jsxs(type, props, key) {
  return create(type, props, key, true);
}
