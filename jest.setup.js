// Global Jest setup - suppress known test warnings
const originalError = console.error;
const originalWarn = console.warn;

// Suppress React DOM prop warnings in tests (from mocked components)
console.error = (...args) => {
  const msg = args[0];
  if (
    typeof msg === 'string' &&
    (msg.includes('React does not recognize the') ||
     msg.includes('Warning: Invalid DOM property') ||
     msg.includes('Warning: Unknown event handler') ||
     msg.includes('Warning: Function components cannot be given refs') ||
     msg.includes('Warning: Received') ||
     msg.includes('for a non-boolean attribute') ||
     msg.includes('validateDOMNesting') ||
     msg.includes('Cannot infer the option value') ||
     msg.includes('Invalid prop'))
  ) {
    return; // Suppress React DOM prop warnings
  }
  originalError(...args);
};

// Suppress Vue lifecycle warnings (composables tested outside setup())
console.warn = (...args) => {
  const msg = args[0];
  if (
    typeof msg === 'string' &&
    (msg.includes('onMounted is called when there is no active component instance') ||
     msg.includes('onUnmounted is called when there is no active component instance') ||
     msg.includes('Lifecycle injection APIs can only be used during execution of setup()'))
  ) {
    return; // Suppress Vue lifecycle warnings
  }
  originalWarn(...args);
};
