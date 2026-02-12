import { signal } from '@angular/core';
import { createLatestCallback } from '../utils/latestRef';

describe('Latest ref utilities', () => {
  describe('createLatestCallback', () => {
    it('should create stable callback that invokes latest function', () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      const fnSignal = signal<(...args: unknown[]) => void>(fn1);
      const stable = createLatestCallback(fnSignal);

      // Call stable callback
      stable('arg1');
      expect(fn1).toHaveBeenCalledWith('arg1');
      expect(fn2).not.toHaveBeenCalled();

      // Update function
      fnSignal.set(fn2);

      // Call stable callback again (same reference)
      stable('arg2');
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledWith('arg2');
    });

    it('should preserve function arguments', () => {
      const fn = jest.fn();
      const fnSignal = signal<(...args: unknown[]) => void>(fn);
      const stable = createLatestCallback(fnSignal);

      stable(1, 'hello', true, { key: 'value' });

      expect(fn).toHaveBeenCalledWith(1, 'hello', true, { key: 'value' });
    });

    it('should preserve return value', () => {
      const fn = jest.fn(() => 'result');
      const fnSignal = signal<(...args: unknown[]) => string>(fn);
      const stable = createLatestCallback(fnSignal);

      const result = stable();

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalled();
    });
  });
});
