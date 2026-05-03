/**
 * Bun test setup — runs once before any test file.
 *
 * Bootstraps a happy-dom global, registers jest-dom matchers, polyfills the
 * DOM APIs OGrid relies on (PointerEvent, ResizeObserver), wires per-test
 * cleanup for React Testing Library, and suppresses known test-noise console
 * output so failure diagnostics stay readable.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { afterEach, expect, jest, mock, spyOn } from 'bun:test';

// Expose Jest-compat globals so existing tests written against Jest API
// (jest.fn, jest.spyOn, jest.useFakeTimers, jest.clearAllMocks, etc.) keep
// working under bun:test without per-file imports.
const g = globalThis as Record<string, unknown>;
g.jest = jest;
g.mock = mock;
g.spyOn = spyOn;

if (typeof document === 'undefined') {
  GlobalRegistrator.register();
}

// Happy-dom ships a buggy Worker stub that breaks workerSortFilter fallback
// detection. Core tests assume `typeof Worker === 'undefined'` triggers the
// sync path; remove the stub so the fallback engages.
delete (globalThis as { Worker?: unknown }).Worker;

// jest-dom matchers (toBeInTheDocument, toHaveAttribute, etc.)
const jestDomMatchers = await import('@testing-library/jest-dom/matchers');
// biome-ignore lint/suspicious/noExplicitAny: jest-dom matchers' types vary
expect.extend(jestDomMatchers as any);

// React Testing Library auto-cleanup between tests (mirrors Jest's default).
// Also force-clear the happy-dom body since some tests render into the document
// without registering with RTL's container tracker.
const { cleanup } = await import('@testing-library/react');
afterEach(() => {
  cleanup();
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
  }
});

// PointerEvent polyfill — happy-dom does not provide one.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    width: number;
    height: number;
    pressure: number;
    tangentialPressure: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
      this.pointerType = params.pointerType ?? '';
      this.isPrimary = params.isPrimary ?? false;
    }
  }
  // biome-ignore lint/suspicious/noExplicitAny: polyfill assignment
  (globalThis as any).PointerEvent = PointerEventPolyfill;
}

// ResizeObserver stub — used by virtualization-related code.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  // biome-ignore lint/suspicious/noExplicitAny: polyfill assignment
  (globalThis as any).ResizeObserver = ResizeObserverStub;
}

// Suppress noisy React DOM warnings so failures stand out.
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args[0];
  if (
    typeof msg === 'string' &&
    (msg.includes('The above error occurred') ||
      msg.includes('React will try to recreate') ||
      msg.includes('React does not recognize the') ||
      msg.includes('Warning: Invalid DOM property') ||
      msg.includes('Warning: Unknown event handler') ||
      msg.includes('Warning: Function components cannot be given refs') ||
      msg.includes('Warning: Received') ||
      msg.includes('for a non-boolean attribute') ||
      msg.includes('validateDOMNesting') ||
      msg.includes('Cannot infer the option value') ||
      msg.includes('Invalid prop'))
  ) {
    return;
  }
  originalError(...args);
};
