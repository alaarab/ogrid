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

// NgZone stub — runOutsideAngular just executes the callback
class NgZone {
  runOutsideAngular(fn) { return fn(); }
  run(fn) { return fn(); }
}

// DI — returns stubs for known tokens, or constructs @Injectable() classes
const inject = (token) => {
  if (token === DestroyRef) return new DestroyRef();
  if (token === NgZone) return new NgZone();
  // For @Injectable() service classes (DataGridStateService, ColumnReorderService, etc.),
  // construct a new instance so base class inject() calls work in test factories.
  if (typeof token === 'function') {
    try { return new token(); } catch { return undefined; }
  }
  return undefined;
};

// DestroyRef stub
class DestroyRef {
  onDestroy(fn) {}
}

// EventEmitter stub — simple pub/sub for @Output() decorators
class EventEmitter {
  constructor() {
    this._listeners = [];
  }
  emit(value) {
    for (const fn of this._listeners) fn(value);
  }
  subscribe(fn) {
    this._listeners.push(fn);
    return { unsubscribe: () => {
      const idx = this._listeners.indexOf(fn);
      if (idx >= 0) this._listeners.splice(idx, 1);
    }};
  }
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
  NgZone,
  ElementRef,
  EventEmitter,
  TemplateRef,
  ChangeDetectionStrategy: { OnPush: 0, Default: 1 },
  ViewEncapsulation: { Emulated: 0, None: 2, ShadowDom: 3 },
  // Lifecycle interface stubs (no-ops, Angular checks implements at runtime)
  OnChanges: {},
  SimpleChanges: {},
};
