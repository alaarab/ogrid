// Mock @angular/core for Jest smoke tests.
// Provides stubs for decorators, signals, and DI primitives used by ogrid-angular.

const noop = () => {};
const identity = (v) => v;

// Decorator factories — return the class/method unchanged
const Injectable = (opts) => (target) => target;
const Component = (opts) => (target) => target;
const Input = (opts) => (target, propertyKey) => {};
const Output = (opts) => (target, propertyKey) => {};
const ViewChild = (selector, opts) => (target, propertyKey) => {};

// Signal primitives — return simple getter functions
const signal = (initial) => {
  let value = initial;
  const s = () => value;
  s.set = (v) => { value = v; };
  s.update = (fn) => { value = fn(value); };
  return s;
};
const computed = (fn) => fn;
const effect = (fn) => ({ destroy: noop });

// Input/output factories
const input = Object.assign(
  (initialValue) => signal(initialValue),
  { required: (opts) => signal(undefined) }
);
const output = (opts) => ({ emit: noop, subscribe: noop });

// viewChild — returns a signal-like function
const viewChild = (selector) => signal(undefined);

// DI — returns stubs for known tokens
const inject = (token) => {
  if (token === DestroyRef) return new DestroyRef();
  return undefined;
};

// DestroyRef stub
class DestroyRef {
  onDestroy(fn) {}
}

// ElementRef stub
class ElementRef {
  constructor(nativeElement) {
    this.nativeElement = nativeElement || null;
  }
}

// TemplateRef stub (used in type positions only, but exported for completeness)
class TemplateRef {}

// Type stub (used in type positions only)
// No-op — it's a generic interface in Angular

module.exports = {
  Injectable,
  Component,
  Input,
  Output,
  ViewChild,
  signal,
  computed,
  effect,
  input,
  output,
  viewChild,
  inject,
  DestroyRef,
  ElementRef,
  TemplateRef,
  ChangeDetectionStrategy: { OnPush: 0, Default: 1 },
};
