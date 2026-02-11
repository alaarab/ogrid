import { EventEmitter } from '../state/EventEmitter';

describe('EventEmitter', () => {
  it('calls registered handlers when event is emitted', () => {
    const emitter = new EventEmitter<{ test: string }>();
    const handler = jest.fn();

    emitter.on('test', handler);
    emitter.emit('test', 'hello');

    expect(handler).toHaveBeenCalledWith('hello');
  });

  it('supports multiple handlers for the same event', () => {
    const emitter = new EventEmitter<{ test: string }>();
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    emitter.on('test', handler1);
    emitter.on('test', handler2);
    emitter.emit('test', 'hello');

    expect(handler1).toHaveBeenCalledWith('hello');
    expect(handler2).toHaveBeenCalledWith('hello');
  });

  it('removes a specific handler with off()', () => {
    const emitter = new EventEmitter<{ test: string }>();
    const handler = jest.fn();

    emitter.on('test', handler);
    emitter.off('test', handler);
    emitter.emit('test', 'hello');

    expect(handler).not.toHaveBeenCalled();
  });

  it('removes all listeners for a specific event', () => {
    const emitter = new EventEmitter<{ test: string; other: number }>();
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    emitter.on('test', handler1);
    emitter.on('other', handler2);
    emitter.removeAllListeners('test');

    emitter.emit('test', 'hello');
    emitter.emit('other', 42);

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledWith(42);
  });

  it('removes all listeners when no event specified', () => {
    const emitter = new EventEmitter<{ test: string; other: number }>();
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    emitter.on('test', handler1);
    emitter.on('other', handler2);
    emitter.removeAllListeners();

    emitter.emit('test', 'hello');
    emitter.emit('other', 42);

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('does not throw when emitting with no handlers', () => {
    const emitter = new EventEmitter<{ test: string }>();
    expect(() => emitter.emit('test', 'hello')).not.toThrow();
  });
});
