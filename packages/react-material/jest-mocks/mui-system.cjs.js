// Mock for @mui/system — only keyframes is used
function keyframes(strings) {
  // Return a stable CSS class name; in tests the animation won't run but the
  // string is referenced inside sx({ animation: `${result} ...` })
  return 'mock-keyframes';
}

module.exports = { keyframes };
