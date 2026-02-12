import { debounce } from '../utils/debounce';

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should delay function execution', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('test');
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledWith('test');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should reset delay on repeated calls', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('a');
    jest.advanceTimersByTime(100);

    debounced('b');
    jest.advanceTimersByTime(100);

    debounced('c');
    jest.advanceTimersByTime(100);

    // Still not called after 300ms total (100+100+100)
    expect(fn).not.toHaveBeenCalled();

    // Called after final 200ms elapsed from last call
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledWith('c');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should execute with latest arguments', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('first');
    debounced('second');
    debounced('third');

    jest.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledWith('third');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cancel pending invocations', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('test');
    jest.advanceTimersByTime(100);

    debounced.cancel();
    jest.advanceTimersByTime(300);

    expect(fn).not.toHaveBeenCalled();
  });

  it('should work with multiple calls after cancel', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('first');
    debounced.cancel();

    debounced('second');
    jest.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledWith('second');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple arguments', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('arg1', 'arg2', 'arg3');
    jest.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
  });

  it('should be safe to cancel when not pending', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced.cancel(); // Cancel when nothing pending
    expect(fn).not.toHaveBeenCalled();

    debounced('test');
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledWith('test');

    debounced.cancel(); // Cancel after execution
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should support zero delay', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 0);

    debounced('test');
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledWith('test');
  });
});
