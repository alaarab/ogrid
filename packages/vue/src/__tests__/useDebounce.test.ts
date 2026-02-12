import { ref, nextTick } from 'vue';
import { useDebounce, useDebouncedCallback } from '../composables/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces value changes', async () => {
    const value = ref('initial');
    const debouncedValue = useDebounce(value, 300);

    expect(debouncedValue.value).toBe('initial');

    value.value = 'updated';
    expect(debouncedValue.value).toBe('initial'); // Not updated yet

    // Flush Vue's watch (microtask) then advance the debounce timer
    await nextTick();
    jest.advanceTimersByTime(150);
    expect(debouncedValue.value).toBe('initial'); // Still not updated

    jest.advanceTimersByTime(150);
    expect(debouncedValue.value).toBe('updated'); // Now updated
  });

  it('cancels previous timeout on rapid changes', async () => {
    const value = ref('initial');
    const debouncedValue = useDebounce(value, 300);

    value.value = 'change1';
    await nextTick();
    jest.advanceTimersByTime(100);

    value.value = 'change2';
    await nextTick();
    jest.advanceTimersByTime(100);

    value.value = 'change3';
    await nextTick();
    jest.advanceTimersByTime(300);

    expect(debouncedValue.value).toBe('change3');
  });

  it('uses custom delay', async () => {
    const value = ref('initial');
    const debouncedValue = useDebounce(value, 500);

    value.value = 'updated';
    await nextTick();

    jest.advanceTimersByTime(400);
    expect(debouncedValue.value).toBe('initial');

    jest.advanceTimersByTime(100);
    expect(debouncedValue.value).toBe('updated');
  });

  it('handles multiple value changes correctly', async () => {
    const value = ref(0);
    const debouncedValue = useDebounce(value, 200);

    value.value = 1;
    await nextTick();
    jest.advanceTimersByTime(200);
    expect(debouncedValue.value).toBe(1);

    value.value = 2;
    await nextTick();
    jest.advanceTimersByTime(200);
    expect(debouncedValue.value).toBe(2);

    value.value = 3;
    await nextTick();
    jest.advanceTimersByTime(200);
    expect(debouncedValue.value).toBe(3);
  });
});

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces callback execution', () => {
    const callback = jest.fn();
    const debouncedCallback = useDebouncedCallback(callback, 300);

    debouncedCallback('arg1');
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(callback).toHaveBeenCalledWith('arg1');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cancels previous timeout on rapid calls', () => {
    const callback = jest.fn();
    const debouncedCallback = useDebouncedCallback(callback, 300);

    debouncedCallback('call1');
    jest.advanceTimersByTime(100);

    debouncedCallback('call2');
    jest.advanceTimersByTime(100);

    debouncedCallback('call3');
    jest.advanceTimersByTime(300);

    expect(callback).toHaveBeenCalledWith('call3');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('preserves callback arguments', () => {
    const callback = jest.fn();
    const debouncedCallback = useDebouncedCallback(callback, 200);

    debouncedCallback('arg1', 'arg2', 123);
    jest.advanceTimersByTime(200);

    expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 123);
  });

  it('handles multiple separate invocations', () => {
    const callback = jest.fn();
    const debouncedCallback = useDebouncedCallback(callback, 200);

    debouncedCallback('first');
    jest.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledWith('first');

    debouncedCallback('second');
    jest.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledWith('second');

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('cancel method prevents execution', () => {
    const callback = jest.fn();
    const debouncedCallback = useDebouncedCallback(callback, 300);

    debouncedCallback('test');
    debouncedCallback.cancel();

    jest.advanceTimersByTime(300);
    expect(callback).not.toHaveBeenCalled();
  });

  it('flush method executes immediately', () => {
    const callback = jest.fn();
    const debouncedCallback = useDebouncedCallback(callback, 300);

    debouncedCallback('test');
    expect(callback).not.toHaveBeenCalled();

    debouncedCallback.flush();
    expect(callback).toHaveBeenCalledWith('test');
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
