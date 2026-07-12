/**
 * Guards the "same API, one-line import to switch" promise: every runtime
 * export of @alaarab/ogrid-react-radix must also exist in this package.
 * (Type-only exports are erased at runtime and are covered by typecheck.)
 */
import { describe, expect, it } from 'bun:test';
import * as fluent from '../index';
// Import radix source directly so the test doesn't require its dist build.
import * as radix from '../../../react-radix/src/index';

describe('public API parity with @alaarab/ogrid-react-radix', () => {
  it('exports every runtime export that the radix package exports', () => {
    const fluentExports = new Set(Object.keys(fluent));
    const missing = Object.keys(radix).filter((name) => !fluentExports.has(name));
    expect(missing).toEqual([]);
  });
});
