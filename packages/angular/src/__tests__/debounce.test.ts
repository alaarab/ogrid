import { createDebouncedCallback, debounce } from '../utils/debounce';

describe('Debounce utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createDebouncedCallback', () => {
    it('should debounce function calls', () => {
      const fn = jest.fn();
      const debounced = createDebouncedCallback(fn, 300);

      debounced('arg1');
      debounced('arg2');
      debounced('arg3');

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg3');
    });

    it('should reset timer on each call', () => {
      const fn = jest.fn();
      const debounced = createDebouncedCallback(fn, 300);

      debounced('arg1');
      jest.advanceTimersByTime(200);

      debounced('arg2');
      jest.advanceTimersByTime(200);

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg2');
    });

    it('should preserve function arguments', () => {
      const fn = jest.fn();
      const debounced = createDebouncedCallback(fn, 300);

      debounced(1, 'hello', true, { key: 'value' });

      jest.advanceTimersByTime(300);

      expect(fn).toHaveBeenCalledWith(1, 'hello', true, { key: 'value' });
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 300);

      debounced('arg1');
      debounced('arg2');
      debounced('arg3');

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg3');
    });

    it('should cancel pending execution', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 300);

      debounced('arg1');
      jest.advanceTimersByTime(200);

      debounced.cancel();

      jest.advanceTimersByTime(300);

      expect(fn).not.toHaveBeenCalled();
    });

    it('should handle multiple cancel calls', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 300);

      debounced('arg1');
      debounced.cancel();
      debounced.cancel(); // Should not throw

      jest.advanceTimersByTime(300);

      expect(fn).not.toHaveBeenCalled();
    });

    it('should reset after cancel', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 300);

      debounced('arg1');
      debounced.cancel();

      debounced('arg2');
      jest.advanceTimersByTime(300);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg2');
    });
  });
});
